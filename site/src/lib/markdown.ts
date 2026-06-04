import MarkdownIt from "markdown-it";
import type { Post } from "./content";

function renderCallouts(html: string) {
  return html.replace(
    /<blockquote>\s*<p>\[!(note|warning|tip)](?:\s*<br\s*\/?>|\s*\n)\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
    (_match, type, body) => `<aside class="callout callout-${type.toLowerCase()}">${body}</aside>`
  );
}

function renderInternalLinks(markdown: string, posts: Post[]) {
  const byTitle = new Map(posts.map((post) => [post.title, post]));

  return markdown.replace(/\[\[([^|\]]+)(?:\|([^\]]+))?]]/g, (_match, title, alias) => {
    const post = byTitle.get(title.trim());
    const label = (alias ?? title).trim();
    if (!post) return label;
    return `[${label}](/posts/${post.slug}/)`;
  });
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

export function renderMarkdown(markdown: string, posts: Post[]) {
  const linked = renderInternalLinks(markdown, posts);
  return renderCallouts(md.render(linked));
}
