import { describe, expect, it } from "vitest";
import { fallbackConversationDecision, parseConversationDecision } from "./intent-fallback.js";

describe("conversation decisions", () => {
  it("does not plan for a recommendation request", () => {
    expect(fallbackConversationDecision("推荐几个首尔好吃的地方").action).toBe("recommend_places");
  });

  it("plans only when the user explicitly asks", () => {
    expect(fallbackConversationDecision("帮我规划首尔五天行程").action).toBe("create_plan");
  });

  it("rejects an unknown action", () => {
    expect(() => parseConversationDecision({ kind: "travel", action: "delete_trip", reply: null, parameters: {} })).toThrow();
  });
});
