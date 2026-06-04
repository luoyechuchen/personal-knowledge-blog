import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "content", "posts");
const outputFile = path.join(root, "public", "search-index.json");

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\[\[([^|\]]+)\|([^\]]+)]]/g, "$2")
    .replace(/\[\[([^\]]+)]]/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

const entries = [];
const postFolders = await readdir(postsDir, { withFileTypes: true }).catch(() => []);

for (const folder of postFolders) {
  if (!folder.isDirectory()) continue;

  const postDir = path.join(postsDir, folder.name);
  const meta = await readJson(path.join(postDir, "meta.json"));
  if (meta.status !== "published") continue;

  const markdown = await readFile(path.join(postDir, "index.md"), "utf8");
  const content = stripMarkdown(markdown);

  entries.push({
    title: meta.title,
    path: `/posts/${meta.slug}/`,
    excerpt: meta.summary || content.slice(0, 120),
    content
  });
}

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`Generated ${entries.length} search entries.`);
