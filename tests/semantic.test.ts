import { describe, expect, it } from "vitest";
import { normalizeFeishuMarkdown, replaceFeishuImageTokens } from "../src/pipeline/semantic.js";

describe("normalizeFeishuMarkdown", () => {
  it("converts typed blockquotes into feishu callout sections", () => {
    const source = [
      "> [TIP] 这是一个提示",
      "> 第二行说明",
      "",
      "正文",
    ].join("\n");

    const result = normalizeFeishuMarkdown(source);
    expect(result).toContain('<div class="feishu-callout feishu-callout-tip" data-callout="tip">');
    expect(result).toContain("这是一个提示");
    expect(result).toContain("第二行说明");
    expect(result).toContain("正文");
  });

  it("preserves image captions in feishu image placeholders", () => {
    const source = '<image token="img123" caption="示意图说明" />';
    const result = normalizeFeishuMarkdown(source);
    expect(result).toContain('<feishu-image token="img123" caption="示意图说明" />');
  });

  it("converts feishu callout tags into standard html sections", () => {
    const source = '<callout emoji="lobster" background-color="#eee" border-color="#ccc">\n- 第一条\n- 第二条\n</callout>';
    const result = normalizeFeishuMarkdown(source);
    expect(result).toContain('class="feishu-callout"');
    expect(result).toContain('🦞');
    expect(result).toContain('<ul');
    expect(result).toContain('<li style="margin: 6px 0;">第一条</li>');
  });

  it("converts quote-container text with bold markdown into styled blockquote", () => {
    const source = '<quote-container>\n**成功标志：** 看到提示符\n</quote-container>';
    const result = normalizeFeishuMarkdown(source);
    expect(result).toContain('class="feishu-quote-container"');
    expect(result).toContain('<strong>成功标志：</strong>');
  });
});

describe("replaceFeishuImageTokens", () => {
  it("renders figure + figcaption when caption exists", () => {
    const result = replaceFeishuImageTokens(
      '<feishu-image token="img123" caption="图1：系统结构" />',
      new Map([["img123", "./image-001.png"]]),
    );

    expect(result).toContain('class="feishu-figure"');
    expect(result).toContain('<img src="./image-001.png" alt="图1：系统结构" />');
    expect(result).toContain('class="feishu-caption"');
    expect(result).toContain("图1：系统结构");
  });

  it("falls back to markdown image when caption is absent", () => {
    const result = replaceFeishuImageTokens(
      '<feishu-image token="img123" />',
      new Map([["img123", "./image-001.png"]]),
    );

    expect(result).toBe('![](./image-001.png)');
  });
});
