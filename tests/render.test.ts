import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { prepareRenderContext } from "@wenyan-md/core/wrapper";

describe("prepareRenderContext", () => {
  const defaultOptions = {
    theme: "default",
    highlight: "solarized-light",
    macStyle: true,
    footnote: true,
  };

  beforeEach(() => {
    process.env.WECHAT_APP_ID = "test-app-id";
    process.env.WECHAT_APP_SECRET = "test-app-secret";
  });

  afterEach(async () => {
    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;
    try {
      await fs.unlink(path.resolve(process.cwd(), "my-theme.css"));
    } catch {}
  });

  it("should render content from direct string argument", async () => {
    const input = "# Hello";

    const { gzhContent } = await prepareRenderContext(input, defaultOptions as any, async (value) => ({
      content: value ?? "",
      absoluteDirPath: undefined,
    }));

    expect(gzhContent.content).toContain("<span>Hello</span></h1>");
  });

  it("should render content from stdin when input arg is missing", async () => {
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;

    setTimeout(() => {
      process.stdin.emit("data", "# From Stdin");
      process.stdin.emit("end");
    }, 50);

    const { gzhContent } = await prepareRenderContext(undefined, defaultOptions as any, async () => {
      const content = await new Promise<string>((resolve) => {
        let data = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => (data += chunk));
        process.stdin.on("end", () => resolve(data));
      });
      return { content, absoluteDirPath: undefined };
    });

    expect(gzhContent.content).toContain("<span>From Stdin</span></h1>");
    process.stdin.isTTY = originalIsTTY;
  });

  it("should render content from file when input arg and stdin are missing", async () => {
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true;

    const filePath = path.resolve(process.cwd(), "test.md");
    await fs.writeFile(filePath, "# From File", "utf-8");

    const { gzhContent } = await prepareRenderContext(undefined, { ...defaultOptions, file: "test.md" } as any, async (_input, file) => ({
      content: await fs.readFile(path.resolve(process.cwd(), file!), "utf-8"),
      absoluteDirPath: path.dirname(path.resolve(process.cwd(), file!)),
    }));

    expect(gzhContent.content).toContain("<span>From File</span></h1>");

    await fs.unlink(filePath);
    process.stdin.isTTY = originalIsTTY;
  });

  it("should throw error when no input source is provided", async () => {
    await expect(
      prepareRenderContext(undefined, defaultOptions as any, async () => {
        throw new Error("missing input-content (no argument, no stdin, and no file).");
      }),
    ).rejects.toThrow(/missing input-content/);
  });

  it("should load custom theme css if option provided", async () => {
    const input = "# Content";
    const cssPath = path.resolve(process.cwd(), "my-theme.css");
    await fs.writeFile(cssPath, ".test { color: red; }", "utf-8");

    const { gzhContent } = await prepareRenderContext(input, {
      ...defaultOptions,
      customTheme: "my-theme.css",
    } as any, async (value) => ({
      content: value ?? "",
      absoluteDirPath: undefined,
    }));

    expect(gzhContent.content).toContain("<span>Content</span></h1>");
  });

  it("should preserve callout and figure semantics in rendered html", async () => {
    const input = [
      '# Title',
      '',
      '<section class="feishu-callout feishu-callout-tip" data-callout="tip">',
      '提示内容',
      '</section>',
      '',
      '<figure class="feishu-figure">',
      '<img src="./image-001.png" alt="图注说明" />',
      '<figcaption>图注说明</figcaption>',
      '</figure>',
    ].join('\n');

    const { gzhContent } = await prepareRenderContext(input, defaultOptions as any, async (value) => ({
      content: value ?? "",
      absoluteDirPath: undefined,
    }));

    expect(gzhContent.content).toContain('feishu-callout');
    expect(gzhContent.content).toContain('<figcaption>图注说明</figcaption>');
  });
});
