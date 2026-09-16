import { describe, expect, it } from "vitest";
import {
  ApiErrorSchema,
  CreateConversationRequestSchema,
  HealthResponseSchema,
  SendMessageRequestSchema,
  TranslationResultSchema,
  ImageTranslationResultSchema,
  SpeechTranscriptionSchema,
  TripPlanSchema,
  PlaceResultSchema,
  SavedPlaceSchema,
  CreateSavedPlaceRequestSchema,
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

  it("accepts a bounded guide screenshot import", () => {
    expect(SendMessageRequestSchema.parse({ content: { type: "IMPORT", text: "", images: ["data:image/jpeg;base64,YQ=="] } }).content.type).toBe("IMPORT");
    expect(() => SendMessageRequestSchema.parse({ content: { type: "IMPORT", text: "", images: [] } })).toThrow();
  });

  it("accepts image translation requests and structured results", () => {
    expect(SendMessageRequestSchema.parse({ content: { type: "IMAGE_TRANSLATION", text: "", images: ["data:image/png;base64,YQ=="] } }).content.type).toBe("IMAGE_TRANSLATION");
    expect(ImageTranslationResultSchema.parse({ kind: "menu", title: "菜单翻译", summary: "识别到 1 道菜", sourceText: "비빔밥", sections: [], menuItems: [{ name: "拌饭", originalName: "비빔밥", description: "韩式拌饭", price: "₩10,000" }], uncertainText: [], provider: { ocr: "paddleocr", translation: "openai-compatible" } }).menuItems[0]?.name).toBe("拌饭");
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

  it("validates a bounded speech transcription", () => {
    expect(SpeechTranscriptionSchema.parse({ text: "안녕하세요", language: "ko", languageProbability: 0.98, duration: 1.8 }).language).toBe("ko");
    expect(() => SpeechTranscriptionSchema.parse({ text: "", language: "ko", languageProbability: 2, duration: 1 })).toThrow();
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
      weather: { status: "available", source: "open-meteo", fetchedAt: "2026-09-14T15:00:00.000Z", days: [{ date: "2026-10-01", temperatureMin: 12, temperatureMax: 20, precipitationProbability: 30, weatherCode: 2 }] },
      exchangeRate: { source: "frankfurter", base: "CNY", quote: "KRW", rate: 193.2, date: "2026-09-14", fetchedAt: "2026-09-14T15:00:00.000Z" },
      days: [{ dayNumber: 1, date: "2026-10-01", title: "古宫散步", estimatedCost: 100, items: [{ id: "8ba7d65d-f8d2-481e-8d42-86651a835777", time: "10:00", title: "景福宫", description: "慢慢游览", estimatedCost: 100, currency: "CNY", place: { id: "92de6446-a3cc-40ed-9f6d-c0f76209f632", name: "경복궁", nameZh: "景福宫", address: "서울 종로구 사직로 161", latitude: 37.5796, longitude: 126.9769, mapUrl: "https://place.map.kakao.com/1", saved: false } }] }],
    }).exchangeRate?.rate).toBe(193.2);
  });

  it("validates normalized place data with source freshness", () => {
    expect(PlaceResultSchema.parse({ id: "92de6446-a3cc-40ed-9f6d-c0f76209f632", name: "경복궁", address: "서울 종로구", latitude: 37.5796, longitude: 126.9769, category: "문화유적", provider: "kakao", sourceUrl: "https://place.map.kakao.com/1", fetchedAt: "2026-09-14T15:00:00.000Z", expiresAt: "2026-09-15T15:00:00.000Z" }).provider).toBe("kakao");
  });

  it("validates saved places and bounded notes", () => {
    expect(SavedPlaceSchema.parse({ id: "8ba7d65d-f8d2-481e-8d42-86651a835777", placeId: "92de6446-a3cc-40ed-9f6d-c0f76209f632", name: "경복궁", nameZh: "景福宫", address: null, latitude: 37.5796, longitude: 126.9769, mapUrl: null, note: null, createdAt: "2026-09-16T10:00:00.000Z", updatedAt: "2026-09-16T10:00:00.000Z" }).nameZh).toBe("景福宫");
    expect(() => CreateSavedPlaceRequestSchema.parse({ placeId: "invalid", note: "a".repeat(241) })).toThrow();
  });
});
