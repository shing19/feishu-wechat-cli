import path from "node:path";
import { JSDOM } from "jsdom";
import { markdownToWechatHtml } from "./renderers/wechat-html.js";

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

export function renderFinalWechatHtml(markdown: string, absoluteDirPath?: string): string {
  const html = markdownToWechatHtml(stripFrontmatter(markdown));
  if (!absoluteDirPath) return html;

  const dom = new JSDOM(html);
  const document = dom.window.document;
  for (const img of Array.from(document.querySelectorAll("img")) as HTMLImageElement[]) {
    const src = img.getAttribute("src");
    if (!src || /^(https?:\/\/|data:|asset:\/\/|\/)/i.test(src)) continue;
    img.setAttribute("src", path.resolve(absoluteDirPath, src));
  }
  return document.body.innerHTML;
}
