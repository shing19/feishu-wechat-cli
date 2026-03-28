import { describe, it, expect } from "vitest";
import { withFrontmatter } from "../src/pipeline/frontmatter.js";

describe("feishu markdown image normalization", () => {
  it("replaces image tags by local markdown images when content is wrapped later", () => {
    const source = `# T\n\n![](./image-001.png)`;
    const result = withFrontmatter(source, { title: "T" });
    expect(result).toContain("![](./image-001.png)");
  });
});
