import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@wenyan-md/core/wrapper", () => ({
  addTheme: vi.fn().mockResolvedValue(undefined),
}));

describe("theme helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("applyDefaultTheme should use eva-purple when theme is missing", async () => {
    const theme = await import("../src/theme.js");
    expect(theme.applyDefaultTheme({ highlight: "solarized-light" })).toEqual({
      highlight: "solarized-light",
      theme: "eva-purple",
    });
  });

  it("applyDefaultTheme should preserve explicit theme", async () => {
    const theme = await import("../src/theme.js");
    expect(theme.applyDefaultTheme({ theme: "rainbow" })).toEqual({
      theme: "rainbow",
    });
  });

  it("ensureDefaultThemeRegistered should register bundled theme once", async () => {
    const wrapper = await import("@wenyan-md/core/wrapper");
    const theme = await import("../src/theme.js");

    await theme.ensureDefaultThemeRegistered();
    await theme.ensureDefaultThemeRegistered();

    expect(wrapper.addTheme).toHaveBeenCalledTimes(1);
    expect(wrapper.addTheme).toHaveBeenCalledWith(
      "eva-purple",
      expect.stringContaining(".feishu-wechat-cli/themes/eva-purple.css"),
    );
  });
});
