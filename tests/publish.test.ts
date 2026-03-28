import { describe, it, expect } from "vitest";
import { publishToWechatDraft } from "@wenyan-md/core/publish";

describe("publishToWechatDraft", () => {
  it("should require credentials", async () => {
    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;

    await expect(
      publishToWechatDraft({ title: "t", content: "<p>x</p>" }),
    ).rejects.toThrow("WECHAT_APP_ID / WECHAT_APP_SECRET");
  });

  it("should fail fast on invalid credentials", async () => {
    process.env.WECHAT_APP_ID = "test-app-id";
    process.env.WECHAT_APP_SECRET = "test-app-secret";

    await expect(
      publishToWechatDraft({ title: "t", content: "<p>x</p>" }),
    ).rejects.toThrow(/invalid appid|40013/i);

    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;
  }, 20000);
});
