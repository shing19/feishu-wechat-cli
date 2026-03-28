export interface WechatArticleMeta {
  title: string;
  cover?: string;
  author?: string;
  source_url?: string;
}

function quoteYamlString(value: string): string {
  return JSON.stringify(value);
}

export function withFrontmatter(markdown: string, meta: WechatArticleMeta): string {
  const normalized = markdown.replace(/^---\n[\s\S]*?\n---\n?/, "").trimStart();
  const lines = ["---", `title: ${quoteYamlString(meta.title)}`];

  if (meta.cover) lines.push(`cover: ${quoteYamlString(meta.cover)}`);
  if (meta.author) lines.push(`author: ${quoteYamlString(meta.author)}`);
  if (meta.source_url) lines.push(`source_url: ${quoteYamlString(meta.source_url)}`);

  lines.push("---", "", normalized);
  return lines.join("\n");
}
