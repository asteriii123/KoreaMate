import { describe, expect, it } from "vitest";
import { isGuideImport, shouldSubmitOnEnter } from "./conversation-screen.js";

describe("conversation input keyboard behavior", () => {
  it("uses Enter to send", () => {
    expect(shouldSubmitOnEnter("Enter", false, false)).toBe(true);
  });

  it("keeps Shift+Enter for a newline", () => {
    expect(shouldSubmitOnEnter("Enter", true, false)).toBe(false);
  });

  it("does not send while an IME composition is active", () => {
    expect(shouldSubmitOnEnter("Enter", false, true)).toBe(false);
  });
});

describe("guide import detection", () => {
  it("recognizes the xhslink.cn short links used by Xiaohongshu sharing", () => {
    expect(isGuideImport("攻略 https://xhslink.cn/o/2qn6nyPm62X", 0)).toBe(true);
  });
});
