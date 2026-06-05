import express from "express";
import { createServer as createViteServer } from "vite";
import { pinyin } from "pinyin-pro";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const publicDir = path.join(root, "public");
const isProduction = process.argv.includes("--production");
const app = express();

app.use(express.json({ limit: "12mb" }));

await loadLocalEnv();

async function loadLocalEnv({ override = false } = {}) {
  try {
    const text = await readFile(path.join(root, ".env"), "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || (!override && process.env[match[1]] !== undefined)) continue;
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // A local .env file is optional; the admin still works without view stats.
  }
}

function assertSafeSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug 只能包含小写字母、数字和连字符。");
  }
}

function slugify(text) {
  const withPinyin = String(text || "").replace(/[\u4e00-\u9fff]+/g, (match) =>
    pinyin(match, { toneType: "none", type: "array" }).join("-")
  );

  return withPinyin
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function fallbackSlug(prefix = "post") {
  return `${prefix}-${Date.now()}`;
}

function localTimestamp(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offset);
  const parts = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    Math.floor(absoluteOffset / 60),
    absoluteOffset % 60
  ].map((part) => String(part).padStart(2, "0"));

  return `${parts[0]}-${parts[1]}-${parts[2]}T${parts[3]}:${parts[4]}:${parts[5]}${sign}${parts[6]}:${parts[7]}`;
}

function safeUploadName(name) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "image"}-${Date.now()}${ext || ".png"}`;
}

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJson(relativePath, fallback) {
  try {
    return JSON.parse(await readFile(path.join(contentDir, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(relativePath, data) {
  const file = path.join(contentDir, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function readPostsFrom(baseDir, statusGroup) {
  const folders = await readdir(baseDir, { withFileTypes: true }).catch(() => []);
  const posts = [];

  for (const folder of folders) {
    if (!folder.isDirectory()) continue;

    const postDir = path.join(baseDir, folder.name);
    try {
      const meta = JSON.parse(await readFile(path.join(postDir, "meta.json"), "utf8"));
      const markdown = await readFile(path.join(postDir, "index.md"), "utf8");
      posts.push({ ...meta, markdown, location: statusGroup });
    } catch {
      // Ignore incomplete local folders so one bad draft does not block the admin.
    }
  }

  return posts;
}

async function readState() {
  const columns = await readJson("columns.json", []);
  const archive = await readJson("archive.json", []);
  const library = await readJson("library.json", []);
  const views = await readViewStats();
  const homeFeatured = await readJson("orders/home-featured.json", []);
  const columnOrders = {};

  for (const column of columns) {
    columnOrders[column.slug] = await readJson(`orders/columns/${column.slug}.json`, []);
  }

  const posts = [
    ...(await readPostsFrom(path.join(contentDir, "posts"), "posts")),
    ...(await readPostsFrom(path.join(contentDir, "drafts"), "drafts"))
  ].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  return { columns, archive, library, posts, views, orders: { homeFeatured, columns: columnOrders } };
}

async function readViewStats() {
  await loadLocalEnv({ override: true });

  const url = process.env.VIEW_COUNTER_ADMIN_URL;
  const token = process.env.VIEW_COUNTER_ADMIN_TOKEN;

  if (!url || !token) {
    return {
      enabled: false,
      counts: {},
      message: "未配置浏览量接口"
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`浏览量接口返回 ${response.status}`);

    const data = await response.json();
    const counts = Object.fromEntries((data.views || []).map((item) => [
      item.slug,
      {
        total: Number(item.total) || 0,
        today: Number(item.today) || 0,
        updatedAt: item.updatedAt || ""
      }
    ]));

    return { enabled: true, counts, message: "" };
  } catch (error) {
    return {
      enabled: false,
      counts: {},
      message: error.name === "AbortError" ? "浏览量接口超时" : error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

async function removePostFolder(base, slug) {
  const target = path.join(base, slug);
  if (!target.startsWith(base)) return;
  await rm(target, { recursive: true, force: true });
}

async function removeSlugFromOrder(relativePath, slug) {
  const order = await readJson(relativePath, []);
  const next = order.filter((item) => item !== slug);
  if (next.length !== order.length) {
    await writeJson(relativePath, next);
  }
}

async function cleanupPostOrders(slug) {
  await removeSlugFromOrder("orders/home-featured.json", slug);
  await cleanupColumnOrders(slug);
}

async function cleanupColumnOrders(slug) {
  const ordersDir = path.join(contentDir, "orders", "columns");
  const files = await readdir(ordersDir, { withFileTypes: true }).catch(() => []);
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".json")) continue;
    await removeSlugFromOrder(`orders/columns/${file.name}`, slug);
  }
}

async function uniquePostSlug(slug, originalSlug = "") {
  const publishedDir = path.join(contentDir, "posts");
  const draftsDir = path.join(contentDir, "drafts");
  let next = slug;
  let index = 2;

  while (
    next !== originalSlug &&
    ((await pathExists(path.join(publishedDir, next))) || (await pathExists(path.join(draftsDir, next))))
  ) {
    next = `${slug}-${index}`;
    index += 1;
  }

  return next;
}

async function clearColumnFromPosts(slug) {
  for (const relativeBase of ["posts", "drafts"]) {
    const baseDir = path.join(contentDir, relativeBase);
    const folders = await readdir(baseDir, { withFileTypes: true }).catch(() => []);

    for (const folder of folders) {
      if (!folder.isDirectory()) continue;

      const metaPath = path.join(baseDir, folder.name, "meta.json");
      try {
        const meta = JSON.parse(await readFile(metaPath, "utf8"));
        if (meta.column !== slug) continue;
        await writeFile(metaPath, `${JSON.stringify({ ...meta, column: "" }, null, 2)}\n`);
      } catch {
        // Ignore incomplete post folders; readState already follows the same rule.
      }
    }
  }
}

app.get("/api/state", async (_req, res) => {
  res.json(await readState());
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/posts", async (req, res) => {
  try {
    const post = req.body;
    const requestedSlug = slugify(post.slug || post.title) || fallbackSlug("post");
    const originalSlug = post.originalSlug ? slugify(post.originalSlug) : "";
    assertSafeSlug(requestedSlug);
    if (originalSlug) assertSafeSlug(originalSlug);
    const finalSlug = await uniquePostSlug(requestedSlug, originalSlug);

    const now = localTimestamp();
    const meta = {
      title: String(post.title || "").trim(),
      slug: finalSlug,
      summary: String(post.summary || "").trim(),
      status: post.status === "published" ? "published" : "draft",
      column: String(post.column || "").trim(),
      createdAt: post.createdAt || now,
      updatedAt: now,
      publishedAt: post.status === "published" ? post.publishedAt || now : ""
    };

    if (!meta.title) throw new Error("标题不能为空。");

    const publishedDir = path.join(contentDir, "posts");
    const draftsDir = path.join(contentDir, "drafts");
    const targetBase = meta.status === "published" ? publishedDir : draftsDir;
    const targetDir = path.join(targetBase, meta.slug);

    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, "index.md"), String(post.markdown || ""));
    await writeFile(path.join(targetDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);

    if (originalSlug && originalSlug !== meta.slug) {
      await removePostFolder(publishedDir, originalSlug);
      await removePostFolder(draftsDir, originalSlug);
      await cleanupPostOrders(originalSlug);
    }

    if (meta.status === "published") {
      await removePostFolder(draftsDir, meta.slug);
      await cleanupColumnOrders(meta.slug);
      const order = await readJson(`orders/columns/${meta.column}.json`, []);
      if (meta.column && !order.includes(meta.slug)) {
        await writeJson(`orders/columns/${meta.column}.json`, [...order, meta.slug]);
      }
    } else {
      await removePostFolder(publishedDir, meta.slug);
      await cleanupColumnOrders(meta.slug);
    }

    res.json({ ok: true, post: { ...meta, markdown: post.markdown || "" } });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

app.delete("/api/posts/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    assertSafeSlug(slug);

    await removePostFolder(path.join(contentDir, "posts"), slug);
    await removePostFolder(path.join(contentDir, "drafts"), slug);
    await cleanupPostOrders(slug);

    res.json({ ok: true, state: await readState() });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

app.post("/api/columns", async (req, res) => {
  await writeJson("columns.json", req.body.columns || []);
  res.json({ ok: true });
});

app.delete("/api/columns/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    assertSafeSlug(slug);

    const state = await readState();
    const column = state.columns.find((item) => item.slug === slug);
    if (!column) throw new Error("专栏不存在。");

    await writeJson("columns.json", state.columns.filter((item) => item.slug !== slug));
    await clearColumnFromPosts(slug);
    await rm(path.join(contentDir, "orders", "columns", `${slug}.json`), { force: true });

    res.json({ ok: true, state: await readState() });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

app.post("/api/archive", async (req, res) => {
  await writeJson("archive.json", req.body.archive || []);
  res.json({ ok: true });
});

app.post("/api/library", async (req, res) => {
  await writeJson("library.json", req.body.library || []);
  res.json({ ok: true });
});

app.post("/api/orders/home-featured", async (req, res) => {
  await writeJson("orders/home-featured.json", req.body.slugs || []);
  res.json({ ok: true });
});

app.post("/api/orders/columns/:slug", async (req, res) => {
  assertSafeSlug(req.params.slug);
  await writeJson(`orders/columns/${req.params.slug}.json`, req.body.slugs || []);
  res.json({ ok: true });
});

app.post("/api/uploads", async (req, res) => {
  try {
    const { filename = "image.png", dataUrl } = req.body;
    const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,(.+)$/);
    if (!match) throw new Error("只支持 png、jpg、gif、webp 图片。");

    const name = safeUploadName(filename);
    const file = path.join(publicDir, "uploads", name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(match[2], "base64"));
    res.json({ ok: true, path: `/uploads/${name}` });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

if (isProduction) {
  app.use(express.static(path.join(root, "admin", "dist")));
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    appType: "spa",
    root: path.join(root, "admin")
  });
  app.use(vite.middlewares);
}

const server = app.listen(4321, "127.0.0.1", () => {
  console.log("Local admin running at http://127.0.0.1:4321");
});

server.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
