import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Column = {
  name: string;
  slug: string;
  description: string;
};

export type PostMeta = {
  title: string;
  slug: string;
  summary: string;
  status: "draft" | "published";
  column: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
};

export type Post = PostMeta & {
  markdown: string;
};

export type ArchiveItem = {
  title: string;
  author: string;
  slug?: string;
  url?: string;
  source: string;
  note: string;
  savedAt: string;
  contentMarkdown?: string;
};

export type Book = {
  title: string;
  author: string;
};

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), "../../..");
const contentDir = path.join(root, "content");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(contentDir, file), "utf8"));
}

export async function getColumns(): Promise<Column[]> {
  return readJson<Column[]>("columns.json");
}

export async function getArchiveItems(): Promise<ArchiveItem[]> {
  return readJson<ArchiveItem[]>("archive.json");
}

export async function getArchiveItemBySlug(slug: string): Promise<ArchiveItem | undefined> {
  const items = await getArchiveItems();
  return items.find((item) => item.slug === slug && item.contentMarkdown);
}

export async function getBooks(): Promise<Book[]> {
  return readJson<Book[]>("library.json");
}

export async function getHomeFeaturedOrder(): Promise<string[]> {
  return readJson<string[]>("orders/home-featured.json").catch(() => []);
}

export async function getColumnOrder(columnSlug: string): Promise<string[]> {
  return readJson<string[]>(`orders/columns/${columnSlug}.json`).catch(() => []);
}

export async function getPosts(options: { includeDrafts?: boolean } = {}): Promise<Post[]> {
  const postsDir = path.join(contentDir, "posts");
  const folders = await readdir(postsDir, { withFileTypes: true }).catch(() => []);
  const posts: Post[] = [];

  for (const folder of folders) {
    if (!folder.isDirectory()) continue;

    const postDir = path.join(postsDir, folder.name);
    const meta = JSON.parse(await readFile(path.join(postDir, "meta.json"), "utf8")) as PostMeta;
    if (!options.includeDrafts && meta.status !== "published") continue;

    posts.push({
      ...meta,
      markdown: await readFile(path.join(postDir, "index.md"), "utf8")
    });
  }

  return posts;
}

export async function getPublishedPosts(): Promise<Post[]> {
  return getPosts();
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug);
}

export function sortByNewest(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function sortByOrder(posts: Post[], orderedSlugs: string[]): Post[] {
  const order = new Map(orderedSlugs.map((slug, index) => [slug, index]));
  return [...posts].sort((a, b) => {
    const aOrder = order.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

export function getColumnName(columns: Column[], slug: string): string {
  return columns.find((column) => column.slug === slug)?.name ?? "未归类";
}
