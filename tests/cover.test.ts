import { describe, it, expect } from "vitest";
import { withFrontmatter } from "../src/pipeline/frontmatter.js";

describe("cover frontmatter integration", () => {
  it("writes cover path into frontmatter", () => {
    const result = withFrontmatter("# Hello", { title: "Hello", cover: "./auto-cover.png" });
    expect(result).toContain('cover: "./auto-cover.png"');
  });
});
