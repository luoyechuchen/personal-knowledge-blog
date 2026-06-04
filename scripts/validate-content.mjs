import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const postsDir = path.join(contentDir, "posts");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

const columns = await readJson(path.join(contentDir, "columns.json"));
const columnSlugs = new Set(columns.map((column) => column.slug));
const postSlugs = new Set();
const folders = await readdir(postsDir, { withFileTypes: true });

for (const folder of folders) {
  if (!folder.isDirectory()) continue;

  const postDir = path.join(postsDir, folder.name);
  const meta = await readJson(path.join(postDir, "meta.json"));
  await access(path.join(postDir, "index.md"));

  if (!meta.title || !meta.slug) {
    throw new Error(`${folder.name} is missing title or slug.`);
  }

  if (postSlugs.has(meta.slug)) {
    throw new Error(`Duplicate post slug: ${meta.slug}`);
  }

  if (meta.column && !columnSlugs.has(meta.column)) {
    throw new Error(`${meta.title} references unknown column ${meta.column}.`);
  }

  postSlugs.add(meta.slug);
}

console.log(`Validated ${postSlugs.size} posts and ${columnSlugs.size} columns.`);
