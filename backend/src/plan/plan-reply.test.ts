import { describe, expect, it } from "vitest";
import { applyContextAnswer, inferPendingField } from "./plan-reply.js";

const requirements = { destination: "首尔", departureCity: null, startDate: null, days: 3, travelers: null, budget: null, currency: "CNY", interests: [], pace: null, constraints: [] };

describe("context answers", () => {
  it.each([["3", 3], ["3人", 3], ["三个人", 3], ["我们仨", 3], ["3未", 3]])("understands %s as a traveler count", (text, expected) => {
    expect(applyContextAnswer(requirements, "travelers", text)?.travelers).toBe(expected);
  });

  it("does not reinterpret a number without a pending question", () => {
    expect(applyContextAnswer(requirements, null, "3")?.travelers).toBeNull();
  });

  it("infers the field represented by a short question", () => {
    expect(inferPendingField("几个人一起去？", requirements)).toBe("travelers");
  });
});
