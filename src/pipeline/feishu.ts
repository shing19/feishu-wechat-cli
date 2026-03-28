import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface FeishuFetchResult {
  markdown: string;
  title?: string;
  docToken?: string;
  raw?: unknown;
  assetDir?: string;
  assetPaths?: string[];
}

function extractDocToken(input: string): string | undefined {
  const patterns = [/\/wiki\/([A-Za-z0-9]+)/, /\/docx\/([A-Za-z0-9]+)/, /^([A-Za-z0-9]{10,})$/];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }

  return undefined;
}

function slugifyFileSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "doc";
}

async function runJsonCommand(command: string, args: string[], cwd?: string) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
  });
  const output = `${stdout ?? ""}${stderr ?? ""}`.trim();
  if (!output) throw new Error("命令没有输出内容。");
  const jsonStart = output.indexOf("{");
  const jsonEnd = output.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error(`命令输出中未找到 JSON: ${output}`);
  }
  return JSON.parse(output.slice(jsonStart, jsonEnd + 1));
}

async function downloadFeishuMediaTokens(markdown: string, docToken: string) {
  const tokenMatches = [...markdown.matchAll(/<image\s+token="([^"]+)"[^>]*\/>/g)];
  const uniqueTokens = [...new Set(tokenMatches.map((match) => match[1]).filter(Boolean))];

  if (uniqueTokens.length === 0) {
    return { markdown, assetDir: undefined, assetPaths: [] as string[] };
  }

  const assetDir = path.resolve(process.cwd(), `.tmp/feishu-assets/${slugifyFileSegment(docToken)}`);
  await fs.rm(assetDir, { recursive: true, force: true });
  await fs.mkdir(assetDir, { recursive: true });

  const mapping = new Map<string, string>();
  const assetPaths: string[] = [];

  for (let index = 0; index < uniqueTokens.length; index += 1) {
    const token = uniqueTokens[index];
    const baseName = `image-${String(index + 1).padStart(3, "0")}`;
    const relativeOutput = `./${baseName}`;

    const parsed = await runJsonCommand(
      "lark-cli",
      ["docs", "+media-download", "--token", token, "--output", relativeOutput, "--overwrite"],
      assetDir,
    );

    const savedPath = parsed.data?.saved_path;
    if (!savedPath || typeof savedPath !== "string") {
      throw new Error(`飞书图片下载成功，但未返回 saved_path。token=${token}`);
    }

    const absoluteSavedPath = path.resolve(assetDir, path.basename(savedPath));
    mapping.set(token, `./${path.basename(absoluteSavedPath)}`);
    assetPaths.push(absoluteSavedPath);
  }

  const replacedMarkdown = markdown.replace(/<image\s+token="([^"]+)"[^>]*\/>/g, (_match, token: string) => {
    const localPath = mapping.get(token);
    if (!localPath) return "";
    return `![](${localPath})`;
  });

  return { markdown: replacedMarkdown, assetDir, assetPaths };
}

export async function fetchFeishuDocument(input: string): Promise<FeishuFetchResult> {
  const docToken = extractDocToken(input);
  if (!docToken) {
    throw new Error("无法从输入中解析飞书文档 token。请提供 wiki/docx 链接或 token。");
  }

  const candidates: Array<{ command: string; args: string[]; kind: string }> = [
    { command: "lark-cli", args: ["docs", "+fetch", "--doc", input, "--format", "json"], kind: "primary" },
    { command: "larksuite-cli", args: ["doc", "get", docToken, "--format", "json"], kind: "legacy" },
    { command: "larksuite", args: ["doc", "get", docToken, "--format", "json"], kind: "legacy" },
  ];

  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const parsed = await runJsonCommand(candidate.command, candidate.args);
      const markdown = parsed.markdown ?? parsed.content ?? parsed.data?.markdown ?? parsed.data?.content;
      const title = parsed.title ?? parsed.data?.title;
      if (!markdown || typeof markdown !== "string") {
        throw new Error("命令执行成功，但未返回 markdown/content 字段。");
      }

      if (candidate.kind === "primary") {
        const downloaded = await downloadFeishuMediaTokens(markdown, docToken);
        return {
          markdown: downloaded.markdown,
          title,
          docToken,
          raw: parsed,
          assetDir: downloaded.assetDir,
          assetPaths: downloaded.assetPaths,
        };
      }

      return { markdown, title, docToken, raw: parsed };
    } catch (error) {
      errors.push(`${candidate.command}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error([
    "抓取飞书文档失败。",
    "已尝试命令：lark-cli / larksuite-cli / larksuite",
    ...errors,
  ].join("\n"));
}
