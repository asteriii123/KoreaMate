import { describe, expect, it } from "vitest";
import {
  ApiErrorSchema,
  CreateConversationRequestSchema,
  HealthResponseSchema,
  SendMessageRequestSchema,
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
});
