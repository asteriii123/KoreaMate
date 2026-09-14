import { describe, expect, it } from "vitest";
import {
  ApiErrorSchema,
  CreateConversationRequestSchema,
  HealthResponseSchema,
  SendMessageRequestSchema,
  TranslationResultSchema,
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
});
