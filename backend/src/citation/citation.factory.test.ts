import { describe, expect, it } from "vitest";
import { CitationFactory } from "./citation.factory.js";

describe("CitationFactory", () => {
  const factory = new CitationFactory();
  it("creates verified citations and computes staleness", () => {
    expect(factory.external({ provider: "kakao", sourceUrl: "https://place.map.kakao.com/1", fetchedAt: "2026-09-15T00:00:00.000Z", expiresAt: "2026-09-16T00:00:00.000Z", now: new Date("2026-09-17T00:00:00.000Z") })).toMatchObject({ status: "verified", stale: true });
  });
  it("removes untrusted and insecure provider links", () => {
    expect(factory.external({ provider: "kakao", sourceUrl: "https://evil.example/1", fetchedAt: "2026-09-16T00:00:00.000Z" }).sourceUrl).toBeNull();
    expect(factory.external({ provider: "kakao", sourceUrl: "http://place.map.kakao.com/1", fetchedAt: "2026-09-16T00:00:00.000Z" }).sourceUrl).toBeNull();
  });
  it("creates a source-free assistant suggestion", () => {
    expect(factory.assistant()).toMatchObject({ label: "小助理建议", provider: "koreamate", sourceUrl: null });
  });
});
