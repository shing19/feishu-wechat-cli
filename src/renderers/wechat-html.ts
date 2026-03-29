import { JSDOM } from "jsdom";
import { marked } from "marked";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

const INLINE_CODE_STYLE =
  "background: #1f1b2e; color: #c084fc; padding: 2px 6px; border-radius: 3px; font-size: 14px; font-family: Menlo, Monaco, Consolas, monospace;";

const BLOCK_CODE_STYLE =
  "display: block; background: transparent; color: #f5f3ff; padding: 0; margin: 0; font-size: 13px; line-height: 1.7; font-family: Menlo, Monaco, Consolas, monospace; white-space: pre; tab-size: 2;";

const STYLES: Record<string, string> = {
  h1: "font-size: 22px; font-weight: bold; text-align: center; margin: 24px 0 16px; color: #7c3aed;",
  h2: "font-size: 18px; font-weight: bold; color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 6px; margin: 20px 0 12px;",
  h3: "font-size: 16px; font-weight: bold; color: #7c3aed; margin: 16px 0 8px;",
  p: "font-size: 14px; line-height: 1.8; color: #333; margin: 12px 0; text-align: left;",
  // NOTE: blockquote is handled via renderer override (→ <div>) because WeChat strips <blockquote> tags.
  strong:
    "font-weight: 600; color: #8D3DE6; background-color: rgba(141, 61, 230, 0.08); padding: 2px 6px; border-radius: 3px;",
  em: "color: #6b7280; font-style: italic;",
  ul: "list-style: none; padding-left: 0; margin: 12px 0;",
  ol: "list-style: none; padding-left: 0; margin: 12px 0;",
  li: "font-size: 14px; line-height: 1.8; color: #333; margin: 4px 0; text-align: left;",
  a: "color: #7c3aed; text-decoration: underline;",
  pre: "background: #12111a; color: #f5f3ff; padding: 16px; border-radius: 10px; overflow-x: auto; font-size: 14px; line-height: 1.6; margin: 16px 0; border: 1px solid rgba(192, 132, 252, 0.22);",
  table: "border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 10px;",
  th: "font-size: 10px; font-weight: 600; padding: 6px 10px; border: 1px solid #d1d5db; background-color: #f3f4f6; color: #1f2937;",
  td: "font-size: 10px; padding: 6px 10px; border: 1px solid #d1d5db;",
  hr: "border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;",
  img: "max-width: 100%; border-radius: 8px; margin: 12px auto; display: block;",
};

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string[] | string };
  children?: HastNode[];
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeLanguage(lang?: string): string | null {
  if (!lang) return null;
  const normalized = lang.trim().toLowerCase().replace(/^language-/, "");
  return normalized || null;
}

function tokenStyle(classNames: string[]): string {
  if (classNames.some((c) => c.includes("comment"))) return "color: #8b949e;";
  if (classNames.some((c) => c.includes("string") || c.includes("regexp"))) return "color: #a5d6ff;";
  if (classNames.some((c) => c.includes("keyword") || c.includes("operator"))) return "color: #ff7b72; font-weight: 600;";
  if (classNames.some((c) => c.includes("number") || c.includes("literal"))) return "color: #79c0ff;";
  if (classNames.some((c) => c.includes("function") || c.includes("title"))) return "color: #d2a8ff;";
  if (classNames.some((c) => c.includes("params") || c.includes("variable"))) return "color: #c9d1d9;";
  if (classNames.some((c) => c.includes("built_in") || c.includes("type"))) return "color: #ffa657;";
  if (classNames.some((c) => c.includes("attr") || c.includes("property"))) return "color: #79c0ff;";
  return "color: #c9d1d9;";
}

function renderHighlightedNode(node: HastNode): string {
  if (node.type === "text") return escapeHtml(node.value ?? "");
  if (node.type !== "element") return "";

  const className = node.properties?.className;
  const classNames = Array.isArray(className) ? className : className ? [className] : [];
  const style = tokenStyle(classNames);
  const children = (node.children ?? []).map(renderHighlightedNode).join("");
  return `<span style="${style}">${children}</span>`;
}

function highlightCode(code: string, lang?: string): string {
  const normalizedLang = normalizeLanguage(lang);
  try {
    const tree = normalizedLang ? lowlight.highlight(normalizedLang, code) : lowlight.highlightAuto(code);
    const html = tree.children.map((node) => renderHighlightedNode(node as HastNode)).join("");
    return html || escapeHtml(code);
  } catch {
    return escapeHtml(code);
  }
}

function normalizeListItemHtml(html: string): string {
  return html
    .replace(/^<li>\s*<p>/i, "<li>")
    .replace(/<\/p>\s*<\/li>\s*$/i, "</li>")
    .replace(/<\/p>\s*(<(?:ul|ol)\b)/i, "$1");
}

function decorateLists(html: string): string {
  const dom = new JSDOM(html);
  const { document, HTMLElement } = dom.window;

  for (const ol of Array.from(document.querySelectorAll("ol")) as HTMLElement[]) {
    ol.setAttribute("style", "list-style: none; padding-left: 0; margin: 12px 0;");
    Array.from(ol.children).forEach((node, index, arr) => {
      if (!(node instanceof HTMLElement)) return;
      const original = node.innerHTML;
      const divider = index < arr.length - 1
        ? '<div style="margin: 8px 0 0 1.6em; border-top: 1px solid rgba(141, 61, 230, 0.12);"></div>'
        : "";
      node.setAttribute("style", "font-size: 14px; line-height: 1.8; color: #333; margin: 4px 0; text-align: left; list-style: none;");
      node.innerHTML = `<span style="color:#8d3de6;font-weight:700; margin-right:0.45em;">${index + 1}.</span><span>${original}</span>${divider}`;
    });
  }

  for (const ul of Array.from(document.querySelectorAll("ul")) as HTMLElement[]) {
    ul.setAttribute("style", "list-style: none; padding-left: 0; margin: 12px 0;");
    Array.from(ul.children).forEach((node, index, arr) => {
      if (!(node instanceof HTMLElement)) return;
      const original = node.innerHTML;
      const divider = index < arr.length - 1
        ? '<div style="margin: 8px 0 0 1.6em; border-top: 1px solid rgba(141, 61, 230, 0.12);"></div>'
        : "";
      node.setAttribute("style", "font-size: 14px; line-height: 1.8; color: #333; margin: 4px 0; text-align: left; list-style: none;");
      node.innerHTML = `<span style="color:#8d3de6;font-weight:700; margin-right:0.45em;">→</span><span>${original}</span>${divider}`;
    });
  }

  return document.body.innerHTML;
}

export function markdownToWechatHtml(markdown: string): string {
  const renderer = new marked.Renderer();

  renderer.codespan = ({ text }) => `<code style="${INLINE_CODE_STYLE}">${escapeHtml(text)}</code>`;

  renderer.code = ({ text, lang }) => {
    const highlighted = highlightCode(text, lang);
    const language = normalizeLanguage(lang);
    const languageLabel = language
      ? `<div style="margin: 0 0 6px; font-size: 11px; color: #9ca3af; font-family: Menlo, Monaco, Consolas, monospace; text-transform: uppercase;">${escapeHtml(language)}</div>`
      : "";
    return `${languageLabel}<pre><code data-language="${language ?? ""}" style="${BLOCK_CODE_STYLE}">${highlighted}</code></pre>`;
  };

  renderer.blockquote = ({ text }) =>
    `<div style="${STYLES.blockquote}">${text}</div>`;

  renderer.listitem = (item) => {
    const raw = marked.Renderer.prototype.listitem.call(renderer, item);
    return normalizeListItemHtml(raw);
  };

  let html = marked.parse(markdown, { renderer }) as string;

  for (const [tag, style] of Object.entries(STYLES)) {
    const regex = new RegExp(`<${tag}(\\s|>)`, "g");
    html = html.replace(regex, `<${tag} style="${style}"$1`);
  }

  html = decorateLists(html);
  return html;
}
