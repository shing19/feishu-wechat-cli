import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addTheme } from "@wenyan-md/core/wrapper";

export const DEFAULT_THEME_ID = "eva-purple";

const DEFAULT_THEME_CSS = `#wenyan {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 15px;
  line-height: 1.8;
  color: #333333;
}

#wenyan h1 {
  margin: 24px 0 16px;
  text-align: center;
  font-size: 1.55em;
  font-weight: 700;
  color: #7c3aed;
}

#wenyan h1::after {
  content: "";
  display: block;
  width: 6em;
  margin: 10px auto 0;
  border-bottom: 2px solid #7c3aed;
}

#wenyan h2 {
  margin: 20px 0 12px;
  padding: 0 0 6px 10px;
  font-size: 1.22em;
  font-weight: 700;
  color: #7c3aed;
  border-left: 4px solid #7c3aed;
  border-bottom: 1px solid rgba(124, 58, 237, 0.35);
}

#wenyan h3 {
  margin: 16px 0 8px;
  font-size: 1.08em;
  font-weight: 700;
  color: #7c3aed;
}

#wenyan p {
  margin: 12px 0;
}

#wenyan strong {
  font-weight: 600;
  color: #8d3de6;
  background-color: rgba(141, 61, 230, 0.08);
  padding: 2px 6px;
  border-radius: 3px;
}

#wenyan em {
  color: #6b7280;
}

#wenyan a {
  color: #7c3aed;
  text-decoration: underline;
}

#wenyan blockquote {
  margin: 18px 0;
  padding: 10px 16px;
  color: #2b2b2b;
  font-size: 0.95em;
  font-style: italic;
  border-left: 4px solid #8d3de6;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(141, 61, 230, 0.06) 0%, rgba(38, 213, 76, 0.06) 100%);
}

#wenyan ul,
#wenyan ol {
  margin: 12px 0;
  padding-left: 1.4em;
}

#wenyan li {
  margin: 4px 0;
}

#wenyan code {
  font-family: Menlo, Monaco, Consolas, "Liberation Mono", "Roboto Mono", "Courier New", "Microsoft YaHei", monospace;
}

#wenyan p code,
#wenyan li code,
#wenyan blockquote code,
#wenyan table code {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.92em;
  color: #6f42c1;
  background: #f5f5f5;
}

#wenyan pre {
  margin: 16px 0;
  padding: 16px;
  border-radius: 8px;
  background: #f5f5f5;
}

#wenyan pre code {
  color: #24292e;
  background: transparent;
}

#wenyan img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 12px auto;
  border-radius: 8px;
}

#wenyan table {
  width: 100%;
  margin: 16px 0;
  border-collapse: collapse;
  font-size: 12px;
}

#wenyan th {
  padding: 6px 10px;
  font-weight: 600;
  color: #1f2937;
  border: 1px solid #d1d5db;
  background-color: #f3f4f6;
}

#wenyan td {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
}

#wenyan hr {
  margin: 24px 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}
`;

let ensured = false;

function getBundledThemePath(): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(dir, "themes", `${DEFAULT_THEME_ID}.css`);
}

async function loadDefaultThemeCss(): Promise<string> {
  try {
    return await fs.readFile(getBundledThemePath(), "utf-8");
  } catch {
    return DEFAULT_THEME_CSS;
  }
}

async function ensureThemeFile(): Promise<string> {
  const baseDir = path.join(os.homedir(), ".feishu-wechat-cli", "themes");
  const themePath = path.join(baseDir, `${DEFAULT_THEME_ID}.css`);
  await fs.mkdir(baseDir, { recursive: true });
  await fs.writeFile(themePath, await loadDefaultThemeCss(), "utf-8");
  return themePath;
}

export async function ensureDefaultThemeRegistered(): Promise<void> {
  if (ensured) return;
  const themePath = await ensureThemeFile();
  try {
    await addTheme(DEFAULT_THEME_ID, themePath);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("已存在")) {
      throw error;
    }
  }
  ensured = true;
}

export function applyDefaultTheme<T extends { theme?: string }>(options: T): T {
  return {
    ...options,
    theme: options.theme || DEFAULT_THEME_ID,
  };
}
