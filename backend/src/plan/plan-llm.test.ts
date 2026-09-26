import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleTravelProvider } from "./plan-llm.js";
import { TravelProviderNotConfiguredError } from "./plan-provider.js";

const input = { message: "首尔玩五天，两个人", requirements: null, previousPlan: null, pendingField: null, today: "2026-09-14", memory: { departureCity: null, budgetLevel: null, pace: null, interests: [], constraints: [] } };

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

  it("passes separated knowledge with explicit trust rules", async () => {
    process.env.LLM_API_KEY = "test";
    process.env.LLM_MODEL = "test-model";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        kind: "question",
        requirements: { destination: "首尔", departureCity: null, startDate: null, days: null, travelers: null, budget: null, currency: "CNY", interests: [], pace: null, constraints: [] },
        question: "准备玩几天？",
      }) } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const knowledge = {
      officialFacts: [{ chunkId: "11111111-1111-4111-8111-111111111111", kind: "official_fact" as const, trust: "verified" as const, title: "景福宫", content: "官方地点资料", provider: "kakao", sourceUrl: "https://place.map.kakao.com/1", fetchedAt: "2026-09-17T00:00:00.000Z", expiresAt: null, stale: false, score: 0.9 }],
      personalExperiences: [{ chunkId: "22222222-2222-4222-8222-222222222222", kind: "personal_experience" as const, trust: "assistant_suggestion" as const, title: "景福宫攻略", content: "上午人少", provider: "user-guide", sourceUrl: null, fetchedAt: null, expiresAt: null, stale: false, score: 0.8 }],
    };
    await new OpenAiCompatibleTravelProvider().plan({ ...input, knowledge });
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { messages: Array<{ role: string; content: string }> };
    expect(request.messages[0]?.content).toContain("小助理建议");
    expect(request.messages[0]?.content).toContain("never call them official or verified");
    expect(JSON.parse(request.messages[1]?.content ?? "{}")).toMatchObject({ knowledge });
  });

  it("rejects an invalid plan", async () => {
    process.env.LLM_API_KEY = "test";
    process.env.LLM_MODEL = "test-model";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: "{}" } }] }) }));
    await expect(new OpenAiCompatibleTravelProvider().plan(input)).rejects.toThrow();
  });

  it("repairs a response that omitted the required Korean place query", async () => {
    process.env.LLM_API_KEY = "test";
    process.env.LLM_MODEL = "test-model";
    const basePlan = {
      kind: "plan",
      requirements: { destination: "首尔", departureCity: null, startDate: null, days: 1, travelers: 2, budget: null, currency: "CNY", interests: [], pace: null, constraints: [] },
      title: "首尔一日游",
      summary: "轻松游览。",
      days: [{ dayNumber: 1, date: null, title: "古宫", items: [{ time: "10:00", title: "景福宫", description: "参观古宫", estimatedCost: 0 }] }],
    };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(basePlan) } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ ...basePlan, days: [{ ...basePlan.days[0], items: [{ ...basePlan.days[0].items[0], placeQuery: "경복궁" }] }] }) } }] }) }));

    const result = await new OpenAiCompatibleTravelProvider().plan(input);
    expect(result.kind === "plan" ? result.days[0]?.items[0]?.placeQuery : undefined).toBe("경복궁");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("caps an overlong model-generated day at eight items", async () => {
    process.env.LLM_API_KEY = "test";
    process.env.LLM_MODEL = "test-model";
    const item = { time: "10:00", title: "景点", description: "参观", estimatedCost: 0, placeQuery: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      kind: "plan",
      requirements: { destination: "首尔", departureCity: null, startDate: null, days: 1, travelers: 2, budget: null, currency: "CNY", interests: [], pace: null, constraints: [] },
      title: "首尔一日游",
      summary: "轻松游览。",
      days: [{ dayNumber: 1, date: null, title: "首尔", items: Array.from({ length: 9 }, () => item) }],
    }) } }] }) }));

    const result = await new OpenAiCompatibleTravelProvider().plan(input);
    expect(result.kind === "plan" ? result.days[0]?.items : []).toHaveLength(8);
  });
});
