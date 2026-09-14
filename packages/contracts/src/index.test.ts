import { describe, expect, it } from "vitest";
import {
  ApiErrorSchema,
  CreateConversationRequestSchema,
  HealthResponseSchema,
  SendMessageRequestSchema,
  TranslationResultSchema,
  TripPlanSchema,
} from "./index.js";

describe("shared contracts", () => {
  it("accepts a valid health response", () => {
    expect(HealthResponseSchema.parse({
      status: "ok",
      service: "koreamate-api",
      version: "3.0.0",
    })).toBeTruthy();
  });

  it("rejects an invalid request id", () => {
    expect(() => ApiErrorSchema.parse({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request",
        retryable: false,
        requestId: "not-a-uuid",
      },
    })).toThrow();
  });

  it("accepts the two product conversation modes", () => {
    expect(CreateConversationRequestSchema.parse({ mode: "TRAVEL" }).mode).toBe("TRAVEL");
    expect(CreateConversationRequestSchema.parse({ mode: "TRANSLATION" }).mode).toBe("TRANSLATION");
  });

  it("rejects empty and oversized messages", () => {
    expect(() => SendMessageRequestSchema.parse({ content: { type: "TEXT", text: " " } })).toThrow();
    expect(() => SendMessageRequestSchema.parse({
      content: { type: "TEXT", text: "a".repeat(4_001) },
    })).toThrow();
  });

  it("validates a structured translation result", () => {
    expect(TranslationResultSchema.parse({
      id: "92de6446-a3cc-40ed-9f6d-c0f76209f632",
      sourceLanguage: "zh",
      targetLanguage: "ko",
      sourceText: "请问可以刷卡吗？",
      translatedText: "카드로 결제할 수 있나요?",
      naturalExpression: "카드 결제 가능해요?",
      pronunciation: "卡德 决杰 卡能黑哟",
      politeness: "polite",
    }).targetLanguage).toBe("ko");
  });

  it("validates a structured trip plan", () => {
    expect(TripPlanSchema.parse({
      tripId: "92de6446-a3cc-40ed-9f6d-c0f76209f632",
      versionId: "2c548e49-5fdd-441e-8282-9f2ad1b3425a",
      versionNumber: 1,
      title: "首尔两日游",
      summary: "轻松游览首尔。",
      currency: "CNY",
      totalEstimatedCost: 100,
      days: [{ dayNumber: 1, date: "2026-10-01", title: "古宫散步", estimatedCost: 100, items: [{ id: "8ba7d65d-f8d2-481e-8d42-86651a835777", time: "10:00", title: "景福宫", description: "慢慢游览", estimatedCost: 100, currency: "CNY" }] }],
    }).versionNumber).toBe(1);
  });
});
