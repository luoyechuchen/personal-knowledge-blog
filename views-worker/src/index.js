const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const origins = allowedOrigins(env);
  const allowed = origins.includes(origin) ? origin : origins[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function response(data, init = {}, request, env) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(request && env ? corsHeaders(request, env) : {}),
      ...(init.headers || {})
    }
  });
}

function isAllowedRequestOrigin(request, env) {
  const origins = allowedOrigins(env);
  if (origins.length === 0) return true;
  const origin = request.headers.get("Origin");
  return Boolean(origin && origins.includes(origin));
}

function assertSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Invalid slug");
  }
}

async function readJsonBody(request) {
  const text = await request.text();
  return JSON.parse(text || "{}");
}

async function recordView(request, env) {
  if (!isAllowedRequestOrigin(request, env)) {
    return response({ ok: false, message: "Origin not allowed" }, { status: 403 }, request, env);
  }

  const body = await readJsonBody(request);
  const slug = String(body.slug || "").trim();
  assertSlug(slug);

  const today = new Date().toISOString().slice(0, 10);

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO post_views (slug, total, updated_at)
      VALUES (?, 1, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        total = total + 1,
        updated_at = datetime('now')
    `).bind(slug),
    env.DB.prepare(`
      INSERT INTO post_view_days (slug, date, count)
      VALUES (?, ?, 1)
      ON CONFLICT(slug, date) DO UPDATE SET
        count = count + 1
    `).bind(slug, today)
  ]);

  return response({ ok: true }, { status: 202 }, request, env);
}

async function readViews(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!env.ADMIN_TOKEN || authorization !== `Bearer ${env.ADMIN_TOKEN}`) {
    return response({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(`
    SELECT
      post_views.slug,
      post_views.total,
      COALESCE(post_view_days.count, 0) AS today,
      post_views.updated_at AS updatedAt
    FROM post_views
    LEFT JOIN post_view_days
      ON post_view_days.slug = post_views.slug
      AND post_view_days.date = ?
    ORDER BY post_views.total DESC
  `).bind(today).all();

  return response({ ok: true, views: results || [] });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (url.pathname === "/api/view" && request.method === "POST") {
        return await recordView(request, env);
      }

      if (url.pathname === "/api/admin/views" && request.method === "GET") {
        return await readViews(request, env);
      }

      if (url.pathname === "/api/health" && request.method === "GET") {
        return response({ ok: true });
      }

      return response({ ok: false, message: "Not found" }, { status: 404 });
    } catch (error) {
      return response({ ok: false, message: error.message }, { status: 400 }, request, env);
    }
  }
};
