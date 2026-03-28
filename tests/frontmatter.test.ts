import { describe, it, expect } from "vitest";
import { withFrontmatter } from "../src/pipeline/frontmatter.js";

describe("withFrontmatter", () => {
  it("adds frontmatter to plain markdown", () => {
    const result = withFrontmatter("# Hello", {
      title: "标题",
      cover: "./cover.jpg",
      author: "作者",
      source_url: "https://example.com",
    });

    expect(result).toContain('title: "标题"');
    expect(result).toContain('cover: "./cover.jpg"');
    expect(result).toContain('author: "作者"');
    expect(result).toContain('source_url: "https://example.com"');
    expect(result.trim().endsWith("# Hello")).toBe(true);
  });

  it("replaces existing frontmatter", () => {
    const source = `---\ntitle: old\n---\n\n# New`;
    const result = withFrontmatter(source, { title: "new" });

    expect(result).not.toContain("title: old");
    expect(result).toContain('title: "new"');
    expect(result.trim().endsWith("# New")).toBe(true);
  });
});
