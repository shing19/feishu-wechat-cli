import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@wenyan-md/core/wrapper", () => ({
  addTheme: vi.fn(),
  listThemes: vi.fn(),
  removeTheme: vi.fn(),
  renderAndPublishToServer: vi.fn(),
}));

vi.mock("../src/theme.js", () => ({
  DEFAULT_THEME_ID: "eva-purple",
  ensureDefaultThemeRegistered: vi.fn().mockResolvedValue(undefined),
  applyDefaultTheme: vi.fn((options: Record<string, unknown>) => ({
    ...options,
    theme: options.theme || "eva-purple",
  })),
}));

vi.mock("../src/pipeline/index.js", () => ({
  fetchFeishuDocument: vi.fn(),
  generateWechatCover: vi.fn().mockResolvedValue("/tmp/feishu-assets/doc/auto-cover.png"),
  withFrontmatter: vi.fn((markdown: string, meta: { title: string; cover?: string; author?: string; source_url?: string }) => {
    const lines = ["---", `title: ${JSON.stringify(meta.title)}`];
    if (meta.cover) lines.push(`cover: ${JSON.stringify(meta.cover)}`);
    if (meta.author) lines.push(`author: ${JSON.stringify(meta.author)}`);
    if (meta.source_url) lines.push(`source_url: ${JSON.stringify(meta.source_url)}`);
    lines.push("---", "", markdown);
    return lines.join("\n");
  }),
}));

vi.mock("../src/publish-local.js", () => ({
  publishPatchedContent: vi.fn().mockResolvedValue({ media_id: "mock-media-id" }),
}));

vi.mock("../src/render-final.js", () => ({
  renderFinalWechatHtml: vi.fn().mockReturnValue("<h1>Hello</h1>"),
}));

vi.mock("../src/utils.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/utils.js")>();
  return {
    ...original,
    getInputContent: vi.fn().mockResolvedValue({
      content: "# Hello",
      absoluteDirPath: "/mock/path",
    }),
  };
});

import { createProgram } from "../src/cli.js";
import * as wrapper from "@wenyan-md/core/wrapper";
import * as pipeline from "../src/pipeline/index.js";
import * as publishLocal from "../src/publish-local.js";
import * as renderFinal from "../src/render-final.js";
import * as utils from "../src/utils.js";

describe("CLI Argument Parsing", () => {
  let program: ReturnType<typeof createProgram>;
  const originalHome = process.env.HOME;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = "/tmp";
    vi.mocked(wrapper.renderAndPublishToServer).mockResolvedValue("mock-media-id");
    vi.mocked(utils.getInputContent).mockResolvedValue({
      content: "# Hello",
      absoluteDirPath: "/mock/path",
    });
    vi.mocked(pipeline.fetchFeishuDocument).mockResolvedValue({
      markdown: [
        "# Feishu",
        "",
        '<div class="feishu-callout feishu-callout-tip" data-callout="tip">',
        "提示内容",
        "</div>",
        "",
        '<div class="feishu-figure">',
        '<img src="./image-001.png" alt="图注说明" />',
        '<p class="feishu-caption">图注说明</p>',
        "</div>",
      ].join("\n"),
      title: "Feishu Title",
      assetDir: "/tmp/feishu-assets/doc",
    });
    program = createProgram("1.0.0");
    program.exitOverride();
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    delete process.env.WECHAT_APPID;
    delete process.env.WECHAT_APPSECRET;
    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;
  });

  it("should verify version flag", () => {
    expect(program.version()).toBe("1.0.0");
  });

  it("should call publish command with correct options (local path)", async () => {
    const args = ["node", "feishu-wechat", "publish", "-f", "test.md", "-t", "rainbow", "--no-mac-style"];

    await program.parseAsync(args);

    expect(publishLocal.publishPatchedContent).toHaveBeenCalledTimes(1);
    const call = vi.mocked(publishLocal.publishPatchedContent).mock.calls[0][0];
    expect(call.content).toBe("<h1>Hello</h1>");
  });

  it("should call render command with string input", async () => {
    const args = ["node", "feishu-wechat", "render", "# Hello"];
    const outputSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(args);

    expect(renderFinal.renderFinalWechatHtml).toHaveBeenCalledTimes(1);
    expect(renderFinal.renderFinalWechatHtml).toHaveBeenCalledWith("# Hello", "/mock/path");
    outputSpy.mockRestore();
  });

  it("should fetch feishu content before publish", async () => {
    const fs = await import("node:fs/promises");

    // For feishu flow, getInputContent reads the article.md written to disk
    // We need it to return the actual frontmatter content
    vi.mocked(utils.getInputContent).mockImplementation(async (_input, file) => {
      if (file && file.includes("article.md")) {
        const content = await fs.readFile(file, "utf-8");
        return { content, absoluteDirPath: "/tmp/feishu-assets/doc" };
      }
      return { content: "# Hello", absoluteDirPath: "/mock/path" };
    });

    const args = [
      "node",
      "feishu-wechat",
      "publish",
      "--feishu",
      "https://my.feishu.cn/wiki/abc123",
      "--article-cover",
      "./cover.jpg",
      "--article-author",
      "shing",
    ];

    await program.parseAsync(args);

    expect(pipeline.fetchFeishuDocument).toHaveBeenCalledWith("https://my.feishu.cn/wiki/abc123");
    expect(publishLocal.publishPatchedContent).toHaveBeenCalledTimes(1);
    const call = vi.mocked(publishLocal.publishPatchedContent).mock.calls[0][0];
    expect(call.title).toBe("Feishu Title");
    expect(call.cover).toBe("./cover.jpg");
    expect(call.author).toBe("shing");

    const article = await fs.readFile("/tmp/feishu-assets/doc/article.md", "utf-8");
    expect(article).toContain('title: "Feishu Title"');
    expect(article).toContain('cover: "./cover.jpg"');
    expect(article).toContain('author: "shing"');
    expect(article).toContain("# Feishu");
    expect(article).toContain('class="feishu-callout feishu-callout-tip"');
    expect(article).toContain('class="feishu-caption"');
    expect(article).toContain("图注说明");
  });

  it("should auto generate cover for feishu content", async () => {
    const fs = await import("node:fs/promises");
    const args = [
      "node",
      "feishu-wechat",
      "publish",
      "--feishu",
      "https://my.feishu.cn/wiki/abc123",
      "--auto-cover",
    ];

    await program.parseAsync(args);

    expect(pipeline.generateWechatCover).toHaveBeenCalledWith({
      title: "Feishu Title",
      assetDir: "/tmp/feishu-assets/doc",
    });

    const article = await fs.readFile("/tmp/feishu-assets/doc/article.md", "utf-8");
    expect(article).toContain('cover: "./auto-cover.png"');
  });

  it("should display help when no command is provided", async () => {
    const outputSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const args = ["node", "feishu-wechat"];

    await program.parseAsync(args);

    expect(outputSpy).toHaveBeenCalled();
    outputSpy.mockRestore();
  });
});
