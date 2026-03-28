const INLINE_IMAGE_RE = /<image\s+token="([^"]+)"([^>]*)\/>/g;
const CALLOUT_HEADER_RE = /^\[(TIP|INFO|NOTE|WARNING|WARN|CAUTION|SUCCESS|ERROR)\]\s*(.*)$/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractImageCaption(attrs: string): string | undefined {
  const patterns = [
    /caption="([^"]+)"/i,
    /alt="([^"]+)"/i,
    /title="([^"]+)"/i,
    /name="([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = attrs.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  return undefined;
}

function normalizeImageLine(line: string): string {
  return line.replace(INLINE_IMAGE_RE, (_match, token: string, attrs: string) => {
    const caption = extractImageCaption(attrs);
    const safeCaption = caption ? ` caption="${escapeHtml(caption)}"` : "";
    return `<feishu-image token="${token}"${safeCaption} />`;
  });
}

function detectCalloutType(content: string): { type: string; text: string } | undefined {
  const match = content.match(CALLOUT_HEADER_RE);
  if (!match) return undefined;

  const rawType = match[1].toLowerCase();
  const text = match[2]?.trim() ?? "";
  const type = rawType === "warn" ? "warning" : rawType;
  return { type, text };
}

function normalizeCalloutBlock(lines: string[], startIndex: number): { block?: string; nextIndex: number } {
  const line = lines[startIndex];
  if (!line.startsWith(">")) {
    return { nextIndex: startIndex };
  }

  const blockLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const current = lines[index];
    if (!current.startsWith(">")) break;
    blockLines.push(current.replace(/^>\s?/, ""));
    index += 1;
  }

  const firstMeaningful = blockLines.find((value) => value.trim().length > 0);
  if (!firstMeaningful) {
    return { nextIndex: index };
  }

  const callout = detectCalloutType(firstMeaningful.trim());
  if (!callout) {
    return { nextIndex: startIndex };
  }

  const renderedLines = blockLines.slice();
  const firstMeaningfulIndex = renderedLines.findIndex((value) => value.trim().length > 0);
  renderedLines[firstMeaningfulIndex] = callout.text;

  const inner = renderedLines.join("\n").trim();
  const content = inner ? `\n${inner}\n` : "\n";
  const block = `<section class="feishu-callout feishu-callout-${callout.type}" data-callout="${callout.type}">\n${content}</section>`;
  return { block, nextIndex: index };
}

export function normalizeFeishuMarkdown(markdown: string): string {
  const imageNormalized = markdown.replace(INLINE_IMAGE_RE, (_match, token: string, attrs: string) => {
    const caption = extractImageCaption(attrs);
    const safeCaption = caption ? ` caption="${escapeHtml(caption)}"` : "";
    return `<feishu-image token="${token}"${safeCaption} />`;
  });

  const lines = imageNormalized.split(/\r?\n/);
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const { block, nextIndex } = normalizeCalloutBlock(lines, index);
    if (block) {
      output.push(block);
      index = nextIndex - 1;
      continue;
    }

    output.push(normalizeImageLine(lines[index]));
  }

  return output.join("\n");
}

export interface DownloadedMediaResult {
  markdown: string;
  assetDir?: string;
  assetPaths: string[];
}

export function replaceFeishuImageTokens(markdown: string, tokenToLocalPath: Map<string, string>): string {
  return markdown.replace(/<feishu-image\s+token="([^"]+)"([^>]*)\/>/g, (_match, token: string, attrs: string) => {
    const localPath = tokenToLocalPath.get(token);
    if (!localPath) return "";
    const caption = extractImageCaption(attrs);
    if (caption) {
      return `<figure class="feishu-figure">\n<img src="${localPath}" alt="${escapeHtml(caption)}" />\n<figcaption>${caption}</figcaption>\n</figure>`;
    }
    return `![](${localPath})`;
  });
}
