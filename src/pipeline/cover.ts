import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GenerateWechatCoverOptions {
  title: string;
  assetDir?: string;
}

function sanitizeSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "article";
}

function buildCoverPrompt(title: string): string {
  return [
    "WeChat official account cover illustration, editorial hero image, clean modern Chinese tech media style,",
    "single focal subject, soft lighting, premium composition, strong visual hierarchy, no text, no letters, no watermark,",
    "suitable for article cover, wide banner, polished product illustration, title theme:",
    title,
  ].join(" ");
}

export async function generateWechatCover(options: GenerateWechatCoverOptions): Promise<string> {
  const baseDir = options.assetDir ?? path.resolve(process.cwd(), ".tmp/generated-covers");
  await fs.mkdir(baseDir, { recursive: true });

  const outputPath = path.join(baseDir, `${sanitizeSegment(options.title)}-cover.png`);
  const prompt = buildCoverPrompt(options.title);

  await execFileAsync("python3", [path.resolve(process.cwd(), "scripts/generate-cover.py"), "--prompt", prompt, "--output", outputPath, "--type", "header"], {
    maxBuffer: 5 * 1024 * 1024,
    env: process.env,
  });

  await fs.access(outputPath);
  return outputPath;
}
