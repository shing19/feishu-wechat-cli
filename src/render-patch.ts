import { JSDOM } from "jsdom";

export function patchRenderedWechatHtml(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  for (const pre of Array.from(document.querySelectorAll("pre")) as HTMLElement[]) {
    const style = pre.getAttribute("style") || "";
    pre.setAttribute(
      "style",
      mergeStyle(style, {
        background: "#12111a",
        color: "#f5f3ff",
        border: "1px solid rgba(192, 132, 252, 0.22)",
        "border-radius": "10px",
        padding: "16px",
      }),
    );
  }

  for (const code of Array.from(document.querySelectorAll("pre code")) as HTMLElement[]) {
    const style = code.getAttribute("style") || "";
    code.setAttribute(
      "style",
      mergeStyle(style, {
        background: "transparent",
        color: "#f5f3ff",
      }),
    );
  }

  for (const ol of Array.from(document.querySelectorAll("ol")) as HTMLElement[]) {
    const items = Array.from(ol.children).filter((node): node is HTMLElement => node instanceof dom.window.HTMLElement);
    items.forEach((item, index) => {
      const original = item.innerHTML;
      item.innerHTML = `<span style="color:#8d3de6;font-weight:700; margin-right:0.45em;">${index + 1}.</span><span>${original}</span>`;
      item.setAttribute("style", mergeStyle(item.getAttribute("style") || "", { "list-style": "none" }));
    });
    ol.setAttribute("style", mergeStyle(ol.getAttribute("style") || "", { "padding-left": "0" }));
  }

  for (const ul of Array.from(document.querySelectorAll("ul")) as HTMLElement[]) {
    const items = Array.from(ul.children).filter((node): node is HTMLElement => node instanceof dom.window.HTMLElement);
    items.forEach((item) => {
      const original = item.innerHTML;
      item.innerHTML = `<span style="color:#8d3de6;font-weight:700; margin-right:0.45em;">→</span><span>${original}</span>`;
      item.setAttribute("style", mergeStyle(item.getAttribute("style") || "", { "list-style": "none" }));
    });
    ul.setAttribute("style", mergeStyle(ul.getAttribute("style") || "", { "padding-left": "0" }));
  }

  return document.body.innerHTML;
}

function mergeStyle(existing: string, updates: Record<string, string>): string {
  const map = new Map<string, string>();
  for (const part of existing.split(";")) {
    const [key, value] = part.split(":");
    if (key?.trim() && value?.trim()) map.set(key.trim(), value.trim());
  }
  for (const [key, value] of Object.entries(updates)) {
    map.set(key, value);
  }
  return Array.from(map.entries())
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}
