import path from "node:path";
import { JSDOM } from "jsdom";
import { publishToWechatDraft } from "@wenyan-md/core/publish";

export interface LocalPublishInput {
  title?: string;
  content: string;
  cover?: string;
  author?: string;
  source_url?: string;
  absoluteDirPath?: string;
}

export async function publishPatchedContent(input: LocalPublishInput) {
  const content = absolutizeLocalImages(input.content, input.absoluteDirPath);
  const cover = absolutizeMaybe(input.cover, input.absoluteDirPath);
  return publishToWechatDraft({
    title: input.title || "未命名文章",
    content,
    cover,
    author: input.author,
    source_url: input.source_url,
  });
}

function absolutizeLocalImages(html: string, absoluteDirPath?: string): string {
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

function absolutizeMaybe(value: string | undefined, absoluteDirPath?: string): string | undefined {
  if (!value || !absoluteDirPath) return value;
  if (/^(https?:\/\/|data:|asset:\/\/|\/)/i.test(value)) return value;
  return path.resolve(absoluteDirPath, value);
}
