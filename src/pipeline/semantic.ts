const INLINE_IMAGE_RE = /<image\s+token="([^"]+)"([^>]*)\/>/g;
const CALLOUT_TAG_RE = /<callout([^>]*)>([\s\S]*?)<\/callout>/gi;
const QUOTE_CONTAINER_RE = /<quote-container>([\s\S]*?)<\/quote-container>/gi;
const CALLOUT_HEADER_RE = /^\[(TIP|INFO|NOTE|WARNING|WARN|CAUTION|SUCCESS|ERROR)\]\s*(.*)$/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]+)"`, "i"));
  return match?.[1]?.trim() || undefined;
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

function resolveFeishuEmoji(value: string | undefined): string {
  if (!value) return "💡";
  const table: Record<string, string> = {
    lobster: "🦞",
    bulb: "💡",
    warning: "⚠️",
    info: "ℹ️",
    tip: "💡",
    fire: "🔥",
    star: "⭐",
    check: "✅",
  };
  return table[value.toLowerCase()] || value;
}

function mapFeishuColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const table: Record<string, string> = {
    "dark-gray": "#f3f4f6",
    gray: "#d1d5db",
    blue: "#bfdbfe",
    red: "#fecaca",
    yellow: "#fde68a",
    green: "#bbf7d0",
    purple: "#ddd6fe",
  };
  return table[value.toLowerCase()] || value;
}

function renderInlineMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function normalizeQuoteContainers(markdown: string): string {
  return markdown.replace(QUOTE_CONTAINER_RE, (_match, inner: string) => {
    const lines = inner
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => renderInlineMarkdown(line));

    const content = lines.map((line) => `<p style="margin: 8px 0;">${line}</p>`).join("\n");
    return [
      `<div class="feishu-quote-container" style="margin: 18px 0; padding: 10px 16px; color: #2b2b2b; font-size: 0.95em; border-left: 4px solid #8d3de6; border-radius: 6px; background: linear-gradient(135deg, rgba(141, 61, 230, 0.06) 0%, rgba(38, 213, 76, 0.06) 100%);">`,
      content,
      `</div>`,
    ].join("\n");
  });
}

function normalizeCalloutTags(markdown: string): string {
  return markdown.replace(CALLOUT_TAG_RE, (_match, attrs: string, inner: string) => {
    const emoji = resolveFeishuEmoji(extractAttr(attrs, "emoji"));
    const background = mapFeishuColor(extractAttr(attrs, "background-color"), "#f6f7fb");
    const border = mapFeishuColor(extractAttr(attrs, "border-color"), "#d6d9e0");
    const items = inner
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[-*]\s+/, ""));

    const renderedItems = items.map((item) => `<li style="margin: 6px 0;">${renderInlineMarkdown(item)}</li>`).join("\n");

    return [
      `<div class="feishu-callout" data-callout="true" style="margin: 1.2em 0; padding: 12px 14px; border-radius: 12px; background: ${background}; border: 1px solid ${border};">`,
      `<p style="margin: 0 0 8px 0;"><strong>${emoji} 提示</strong></p>`,
      `<ul style="margin: 0; padding-left: 1.25em;">${renderedItems}</ul>`,
      `</div>`,
    ].join("\n");
  });
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
  const block = `<div class="feishu-callout feishu-callout-${callout.type}" data-callout="${callout.type}">\n${content}</div>`;
  return { block, nextIndex: index };
}

export function normalizeFeishuMarkdown(markdown: string): string {
  const quoteNormalized = normalizeQuoteContainers(markdown);
  const calloutNormalized = normalizeCalloutTags(quoteNormalized);
  const imageNormalized = calloutNormalized.replace(INLINE_IMAGE_RE, (_match, token: string, attrs: string) => {
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
      return [
        `<div class="feishu-figure" style="margin: 1.25em 0; text-align: center;">`,
        `<img src="${localPath}" alt="${escapeHtml(caption)}" />`,
        `<p class="feishu-caption" style="margin-top: 8px; color: #888; font-size: 14px; text-align: center;">${caption}</p>`,
        `</div>`,
      ].join("\n");
    }
    return `![](${localPath})`;
  });
}
