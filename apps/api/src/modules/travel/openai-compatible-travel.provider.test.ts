import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleTravelProvider } from "./openai-compatible-travel.provider.js";
import { TravelProviderNotConfiguredError } from "./travel-provider.js";

const input = { message: "首尔玩五天，两个人", requirements: null, previousPlan: null, pendingField: null, today: "2026-09-14" };

describe("OpenAiCompatibleTravelProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
  });

  it("fails explicitly when credentials are absent", async () => {
    await expect(new OpenAiCompatibleTravelProvider().plan(input)).rejects.toBeInstanceOf(TravelProviderNotConfiguredError);
  });

  it("validates structured planner output", async () => {
    process.env.LLM_API_KEY = "test";
    process.env.LLM_MODEL = "test-model";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        kind: "question",
        requirements: { destination: "首尔", departureCity: null, startDate: null, days: null, travelers: null, budget: null, currency: "CNY", interests: [], pace: null, constraints: [] },
        question: "准备玩几天？",
      }) } }] }),
    }));

    await expect(new OpenAiCompatibleTravelProvider().plan(input)).resolves.toMatchObject({ kind: "question" });
  });

  it("rejects an invalid plan", async () => {
    process.env.LLM_API_KEY = "test";
    process.env.LLM_MODEL = "test-model";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: "{}" } }] }) }));
    await expect(new OpenAiCompatibleTravelProvider().plan(input)).rejects.toThrow();
  });
});
