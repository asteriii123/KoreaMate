import { describe, expect, it } from "vitest";
import { shouldSubmitOnEnter } from "./conversation-screen.js";

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
