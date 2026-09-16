import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AcceptedMessageSchema, ConversationSchema } from "@koreamate/contracts";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/modules/database/prisma.service.js";
import {
  TRANSLATION_PROVIDER,
  type TranslationProvider,
} from "../src/modules/translation/translation-provider.js";
import { TRAVEL_PROVIDER, type TravelProvider } from "../src/modules/travel/travel-provider.js";
import { KakaoPlaceProvider } from "../src/modules/places/kakao-place.provider.js";
import { OpenMeteoWeatherProvider } from "../src/modules/travel/open-meteo-weather.provider.js";
import { FrankfurterExchangeProvider } from "../src/modules/travel/frankfurter-exchange.provider.js";
import { GuideImportService } from "../src/modules/travel/guide-import.service.js";
import { HotelMcpProvider } from "../src/modules/travel/hotel-mcp.provider.js";
import { FlightMcpProvider } from "../src/modules/travel/flight-mcp.provider.js";
import { OpenAiCompatibleMemoryExtractor } from "../src/modules/memory/openai-compatible-memory.extractor.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:55432/koreamate_v3";

describe("conversation persistence", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  async function createConversation(mode: "TRAVEL" | "TRANSLATION"): Promise<{ conversation: { id: string; mode: "TRAVEL" | "TRANSLATION"; createdAt: string }; cookie: string | undefined }> {
    const response = await app.inject({ method: "POST", url: "/api/v1/conversations", payload: { mode } });
    const cookie = response.headers["set-cookie"];
    return { conversation: ConversationSchema.parse(response.json()), cookie: Array.isArray(cookie) ? cookie[0] : cookie };
  }

  beforeAll(async () => {
    const fakeTranslationProvider: TranslationProvider = {
      name: "integration-test",
      async translate(text) {
        return {
          sourceLanguage: "zh",
          targetLanguage: "ko",
          translatedText: `번역: ${text}`,
          naturalExpression: `자연스러운 번역: ${text}`,
          pronunciation: "测试发音",
          politeness: "polite",
        };
      },
      async interpretImageText(text, uncertainText) {
        return { kind: "text", title: "图片翻译", summary: "已识别", sourceText: text, sections: [{ source: text, translation: "图片中文翻译" }], menuItems: [], uncertainText, provider: { ocr: "paddleocr", translation: "integration-test" } };
      },
    };
    const requirements = { destination: "首尔", departureCity: "上海", startDate: "2026-10-01", days: 2, travelers: 3, budget: 3000, currency: "CNY", interests: ["美食"], pace: "balanced" as const, constraints: [] };
    const fakeTravelProvider: TravelProvider = {
      name: "integration-test",
      async plan(input) {
        if (input.message === "想去首尔") {
          return { kind: "question", requirements: { ...requirements, travelers: null }, question: "几个人一起去？" };
        }
        return {
          kind: "plan",
          requirements,
          title: "首尔两日轻旅行",
          summary: input.previousPlan ? "根据你的要求调整了节奏。" : "第一次去首尔也不费力。",
          days: [1, 2].map((dayNumber) => ({ dayNumber, date: null, title: `首尔第 ${dayNumber} 天`, items: [{ time: "10:00", title: dayNumber === 1 ? "景福宫" : "圣水洞", description: "轻松逛逛", estimatedCost: 100 * dayNumber, placeQuery: dayNumber === 1 ? "경복궁" : "성수동" }] })),
        };
      },
    };
    const fakeKakaoProvider = {
      id: "kakao" as const,
      configured: true,
      async search(): Promise<Array<{ provider: "kakao"; externalId: string; name: string; address: string; latitude: number; longitude: number; category: string; sourceUrl: string; raw: { id: string } }>> {
        return [{ provider: "kakao" as const, externalId: "kakao-1", name: "경복궁", address: "서울 종로구 사직로 161", latitude: 37.5796, longitude: 126.9769, category: "문화유적", sourceUrl: "https://place.map.kakao.com/1", raw: { id: "kakao-1" } }];
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TRANSLATION_PROVIDER)
      .useValue(fakeTranslationProvider)
      .overrideProvider(TRAVEL_PROVIDER)
      .useValue(fakeTravelProvider)
      .overrideProvider(KakaoPlaceProvider)
      .useValue(fakeKakaoProvider)
      .overrideProvider(OpenMeteoWeatherProvider)
      .useValue({ forecast: async (input: { startDate: string }) => ({ status: "available", source: "open-meteo", fetchedAt: "2026-09-15T00:00:00.000Z", days: [{ date: input.startDate, temperatureMin: 17, temperatureMax: 24, precipitationProbability: 35, weatherCode: 2 }] }) })
      .overrideProvider(FrankfurterExchangeProvider)
      .useValue({ latest: async () => ({ source: "frankfurter", base: "CNY", quote: "KRW", rate: 200, date: "2026-09-15", fetchedAt: "2026-09-15T00:00:00.000Z" }) })
      .overrideProvider(GuideImportService)
      .useValue({ parse: async () => ({ id: randomUUID(), sourceCount: 1, failedSourceCount: 0, needsFallback: false, items: [{ name: "景福宫", kind: "attraction", note: "古宫", verified: true, place: { id: randomUUID(), name: "경복궁", address: "서울 종로구", latitude: 37.5796, longitude: 126.9769, category: "文化遗产", provider: "kakao", sourceUrl: "https://place.map.kakao.com/1", fetchedAt: "2026-09-15T00:00:00.000Z", expiresAt: "2026-09-16T00:00:00.000Z" } }] }) })
      .overrideProvider(HotelMcpProvider)
      .useValue({ configured: true, search: async (input: { destination: string; checkIn: string; checkOut: string }) => ({ provider: "rollinggo-hotel", destination: input.destination, checkIn: input.checkIn, checkOut: input.checkOut, fetchedAt: "2026-09-15T00:00:00.000Z", hotels: [{ id: "5956", name: "里维埃拉酒店", starRating: 4, lowestPrice: 1017, currency: "CNY", address: "首尔江南区", imageUrl: null, bookingUrl: "https://rollinggo.cn/hotel/5956", recommendation: "性价比之选", cancellation: "免费取消" }] }) })
      .overrideProvider(FlightMcpProvider)
      .useValue({ configured: true, search: async (input: { fromCity: string; toCity: string; departureDate: string }) => ({ provider: "variflight", fromCity: input.fromCity, toCity: input.toCity, departureDate: input.departureDate, fetchedAt: "2026-09-15T00:00:00.000Z", flights: [{ id: "OZ368-2026-10-20", flightNumbers: "OZ368", departureAt: "2026-10-20 01:05:00", arrivalAt: "2026-10-20 04:05:00", duration: "2h", direct: true, transferCity: null, price: 801, currency: "CNY" }] }) })
      .overrideProvider(OpenAiCompatibleMemoryExtractor)
      .useValue({ extract: async () => [] })
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api/v1");
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
    prisma = app.get(PrismaService);
    await prisma.jobEvent.deleteMany();
    await prisma.job.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.placeSource.deleteMany();
    await prisma.place.deleteMany();
    await prisma.providerCall.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a travel conversation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: { mode: "TRAVEL" },
    });

    expect(response.statusCode).toBe(201);
    expect(ConversationSchema.parse(response.json()).mode).toBe("TRAVEL");
  });

  it("returns the same message and job for a repeated idempotency key", async () => {
    const { conversation, cookie } = await createConversation("TRANSLATION");
    const idempotencyKey = randomUUID();
    const request = {
      method: "POST" as const,
      url: `/api/v1/conversations/${conversation.id}/messages`,
      headers: { "idempotency-key": idempotencyKey, cookie },
      payload: { content: { type: "TEXT", text: "请问可以刷卡吗？" } },
    };

    const [firstResponse, secondResponse] = await Promise.all([app.inject(request), app.inject(request)]);
    const first = AcceptedMessageSchema.parse(firstResponse.json());
    const second = AcceptedMessageSchema.parse(secondResponse.json());

    expect(second).toEqual(first);
    expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(1);
    expect(await prisma.job.count({ where: { conversationId: conversation.id } })).toBe(1);
  });

  it("replays persisted job events as SSE", async () => {
    const { conversation, cookie } = await createConversation("TRAVEL");
    const accepted = AcceptedMessageSchema.parse((await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      headers: { "idempotency-key": randomUUID(), cookie },
      payload: { content: { type: "TEXT", text: "十月去首尔五天" } },
    })).json());

    const events = await fetch(`${baseUrl}/api/v1/jobs/${accepted.jobId}/events`);
    const body = await events.text();

    expect(events.status).toBe(200);
    expect(events.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: message.accepted");
    expect(body).toContain("event: job.completed");
  });

  it("persists and streams a real provider translation result", async () => {
    const { conversation, cookie } = await createConversation("TRANSLATION");
    const accepted = AcceptedMessageSchema.parse((await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      headers: { "idempotency-key": randomUUID(), cookie },
      payload: { content: { type: "TEXT", text: "你好" } },
    })).json());

    const response = await fetch(`${baseUrl}/api/v1/jobs/${accepted.jobId}/events`);
    const body = await response.text();
    const translation = await prisma.translation.findUnique({
      where: { sourceMessageId: accepted.messageId },
    });

    expect(response.status).toBe(200);
    expect(body).toContain("event: translation.started");
    expect(body).toContain("event: translation.ready");
    expect(body).toContain("event: job.completed");
    expect(translation?.translatedText).toBe("번역: 你好");
    expect(translation?.provider).toBe("integration-test");
  });

  it("reports providers and persists normalized place sources", async () => {
    const statuses = await app.inject({ method: "GET", url: "/api/v1/providers" });
    expect(statuses.statusCode).toBe(200);
    expect(statuses.json()).toContainEqual({ id: "kakao", configured: true });

    const response = await app.inject({ method: "GET", url: "/api/v1/places/search?query=%E6%99%AF%E7%A6%8F%E5%AE%AB&provider=kakao" });
    expect(response.statusCode).toBe(200);
    expect(response.json()[0]).toMatchObject({ name: "경복궁", provider: "kakao" });
    expect(await prisma.placeSource.count({ where: { provider: "kakao", externalId: "kakao-1" } })).toBe(1);
  });

  it("asks once, creates a validated plan, and preserves versions on modification", async () => {
    const { conversation, cookie } = await createConversation("TRAVEL");
    const send = async (text: string): Promise<string> => {
      const accepted = AcceptedMessageSchema.parse((await app.inject({ method: "POST", url: `/api/v1/conversations/${conversation.id}/messages`, headers: { "idempotency-key": randomUUID(), cookie }, payload: { content: { type: "TEXT", text } } })).json());
      return (await fetch(`${baseUrl}/api/v1/jobs/${accepted.jobId}/events`)).text();
    };

    expect(await send("想去首尔")).toContain("event: travel.question");
    const firstPlanEvents = await send("3");
    expect(firstPlanEvents).toContain("event: travel.plan.ready");
    const savedPlaceEvents = await send("记住景福宫");
    expect(savedPlaceEvents).toContain("event: travel.saved-place.ready");
    expect(savedPlaceEvents).not.toContain("event: travel.plan.ready");
    expect(await prisma.tripVersion.count({ where: { trip: { conversationId: conversation.id } } })).toBe(1);
    expect(await prisma.savedPlace.count()).toBeGreaterThan(0);
    expect(await send("第二天轻松一点")).toContain("event: travel.plan.ready");
    expect(await send("就按这个出发")).toContain("event: travel.trip.confirmed");
    const weatherEvents = await send("今天天气如何");
    expect(weatherEvents).toContain("event: travel.answer");
    expect(weatherEvents).toContain("17–24°C");
    expect(weatherEvents).not.toContain("event: travel.plan.ready");
    const hotelEvents = await send("这次住什么酒店合适？");
    expect(hotelEvents).toContain("event: travel.hotel.ready");
    expect(hotelEvents).not.toContain("event: travel.plan.ready");
    const flightEvents = await send("这次有什么直飞航班？");
    expect(flightEvents).toContain("event: travel.flight.ready");
    expect(flightEvents).not.toContain("event: travel.plan.ready");

    const trip = await prisma.trip.findUnique({ where: { conversationId: conversation.id }, include: { versions: { orderBy: { versionNumber: "asc" }, include: { days: true } } } });
    expect(trip?.versions).toHaveLength(2);
    expect(trip?.versions.map((version) => version.versionNumber)).toEqual([1, 2]);
    expect(Number(trip?.versions[0]?.totalCost)).toBe(300);
    expect(trip?.versions[0]?.days.map((day) => day.date?.toISOString().slice(0, 10))).toEqual(["2026-10-01", "2026-10-02"]);
    expect((await prisma.tripRequirement.findUnique({ where: { tripId: trip?.id } }))?.data).toMatchObject({ travelers: 3 });
    expect(await prisma.itineraryItem.count({ where: { placeId: { not: null } } })).toBeGreaterThan(0);
    expect(await prisma.tripResource.count({ where: { tripId: trip?.id, kind: "weather" } })).toBeGreaterThan(0);
    expect(await prisma.tripResource.count({ where: { tripId: trip?.id, kind: "exchange-rate" } })).toBeGreaterThan(0);
    expect(await prisma.tripResource.count({ where: { tripId: trip?.id, kind: "hotel" } })).toBeGreaterThan(0);
    expect(await prisma.tripResource.count({ where: { tripId: trip?.id, kind: "flight" } })).toBeGreaterThan(0);
    expect(trip?.confirmedVersionId).toBe(trip?.versions[1]?.id);
    const confirmed = await app.inject({ method: "GET", url: "/api/v1/trips/confirmed", headers: { cookie } });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()[0].title).toBe("首尔两日轻旅行");

    const restored = await app.inject({ method: "POST", url: `/api/v1/trips/${trip?.id}/versions/${trip?.versions[0]?.id}/restore`, headers: { cookie } });
    expect(restored.statusCode).toBe(201);
    expect(restored.json().versionNumber).toBe(3);
    expect(await prisma.tripVersion.count({ where: { tripId: trip?.id } })).toBe(3);
  });

  it("previews an xhslink.cn guide without creating a trip version", async () => {
    const { conversation, cookie } = await createConversation("TRAVEL");
    const accepted = AcceptedMessageSchema.parse((await app.inject({ method: "POST", url: `/api/v1/conversations/${conversation.id}/messages`, headers: { "idempotency-key": randomUUID(), cookie }, payload: { content: { type: "TEXT", text: "https://xhslink.cn/o/example" } } })).json());
    const events = await (await fetch(`${baseUrl}/api/v1/jobs/${accepted.jobId}/events`)).text();
    expect(events).toContain("event: travel.import.ready");
    expect(events).not.toContain("event: travel.plan.ready");
    const trip = await prisma.trip.findUnique({ where: { conversationId: conversation.id }, include: { versions: true } });
    expect(trip?.versions).toHaveLength(0);
  });
});
