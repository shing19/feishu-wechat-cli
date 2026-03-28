import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@wenyan-md/core/wrapper", () => {
  const mockRenderAndPublish = vi.fn();
  const mockRenderAndPublishToServer = vi.fn();
  const mockPrepareRenderContext = vi.fn();

  return {
    addTheme: vi.fn(),
    listThemes: vi.fn(),
    removeTheme: vi.fn(),
    prepareRenderContext: mockPrepareRenderContext,
    renderAndPublish: mockRenderAndPublish,
    renderAndPublishToServer: mockRenderAndPublishToServer,
  };
});

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

import { createProgram } from "../src/cli.js";
import * as wrapper from "@wenyan-md/core/wrapper";
import * as pipeline from "../src/pipeline/index.js";

describe("CLI Argument Parsing", () => {
  let program: ReturnType<typeof createProgram>;
  const originalHome = process.env.HOME;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = "/tmp";
    vi.mocked(wrapper.prepareRenderContext).mockResolvedValue({
      gzhContent: { content: "<h1>Hello</h1>" } as any,
      absoluteDirPath: "/mock/path",
    });
    vi.mocked(wrapper.renderAndPublish).mockResolvedValue("mock-media-id");
    vi.mocked(wrapper.renderAndPublishToServer).mockResolvedValue("mock-media-id");
    vi.mocked(pipeline.fetchFeishuDocument).mockResolvedValue({ markdown: "# Feishu", title: "Feishu Title", assetDir: "/tmp/feishu-assets/doc" });
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

  it("should call publish command with correct options", async () => {
    const args = ["node", "feishu-wechat", "publish", "-f", "test.md", "-t", "rainbow", "--no-mac-style"];

    await program.parseAsync(args);

    expect(wrapper.renderAndPublish).toHaveBeenCalledTimes(1);
    const [inputArg, passedOptions] = vi.mocked(wrapper.renderAndPublish).mock.calls[0];
    expect(inputArg).toBeUndefined();
    expect(passedOptions).toEqual(
      expect.objectContaining({
        file: "test.md",
        footnote: true,
        theme: "rainbow",
        macStyle: false,
        highlight: "solarized-light",
      }),
    );
  });

  it("should call render command with string input", async () => {
    const args = ["node", "feishu-wechat", "render", "# Hello"];

    await program.parseAsync(args);

    expect(wrapper.prepareRenderContext).toHaveBeenCalledTimes(1);
    expect(wrapper.prepareRenderContext).toHaveBeenCalledWith(
      "# Hello",
      expect.objectContaining({
        footnote: true,
        theme: "default",
        macStyle: true,
        highlight: "solarized-light",
      }),
      expect.any(Function),
    );
  });

  it("should fetch feishu content before publish", async () => {
    const fs = await import("node:fs/promises");
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
    expect(wrapper.renderAndPublish).toHaveBeenCalledTimes(1);
    const [inputArg, passedOptions] = vi.mocked(wrapper.renderAndPublish).mock.calls[0];
    expect(inputArg).toBeUndefined();
    expect(passedOptions).toEqual(expect.objectContaining({ file: "/tmp/feishu-assets/doc/article.md" }));
    const article = await fs.readFile("/tmp/feishu-assets/doc/article.md", "utf-8");
    expect(article).toContain('title: "Feishu Title"');
    expect(article).toContain('cover: "./cover.jpg"');
    expect(article).toContain('author: "shing"');
    expect(article).toContain("# Feishu");
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
