import express from "express";
import { createServer as createViteServer } from "vite";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const publicDir = path.join(root, "public");
const isProduction = process.argv.includes("--production");
const app = express();

app.use(express.json({ limit: "12mb" }));

function assertSafeSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug 只能包含小写字母、数字和连字符。");
  }
}

function safeUploadName(name) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "image"}-${Date.now()}${ext || ".png"}`;
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
  const homeFeatured = await readJson("orders/home-featured.json", []);
  const columnOrders = {};

  for (const column of columns) {
    columnOrders[column.slug] = await readJson(`orders/columns/${column.slug}.json`, []);
  }

  const posts = [
    ...(await readPostsFrom(path.join(contentDir, "posts"), "posts")),
    ...(await readPostsFrom(path.join(contentDir, "drafts"), "drafts"))
  ].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  return { columns, archive, library, posts, orders: { homeFeatured, columns: columnOrders } };
}

async function removePostFolder(base, slug) {
  const target = path.join(base, slug);
  if (!target.startsWith(base)) return;
  await rm(target, { recursive: true, force: true });
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
    assertSafeSlug(post.slug);

    const now = new Date().toISOString().slice(0, 10);
    const meta = {
      title: String(post.title || "").trim(),
      slug: post.slug,
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

    if (meta.status === "published") {
      await removePostFolder(draftsDir, meta.slug);
      const order = await readJson(`orders/columns/${meta.column}.json`, []);
      if (meta.column && !order.includes(meta.slug)) {
        await writeJson(`orders/columns/${meta.column}.json`, [...order, meta.slug]);
      }
    }

    res.json({ ok: true, post: { ...meta, markdown: post.markdown || "" } });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

app.post("/api/columns", async (req, res) => {
  await writeJson("columns.json", req.body.columns || []);
  res.json({ ok: true });
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
