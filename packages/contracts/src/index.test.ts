import { describe, expect, it } from "vitest";
import { ApiErrorSchema, HealthResponseSchema } from "./index.js";

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
});
