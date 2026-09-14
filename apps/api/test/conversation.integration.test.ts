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

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:55432/koreamate_v3";

describe("conversation persistence", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let baseUrl: string;

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
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TRANSLATION_PROVIDER)
      .useValue(fakeTranslationProvider)
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
    const conversationResponse = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: { mode: "TRANSLATION" },
    });
    const conversation = ConversationSchema.parse(conversationResponse.json());
    const idempotencyKey = randomUUID();
    const request = {
      method: "POST" as const,
      url: `/api/v1/conversations/${conversation.id}/messages`,
      headers: { "idempotency-key": idempotencyKey },
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
    const conversation = ConversationSchema.parse((await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: { mode: "TRAVEL" },
    })).json());
    const accepted = AcceptedMessageSchema.parse((await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      headers: { "idempotency-key": randomUUID() },
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
    const conversation = ConversationSchema.parse((await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: { mode: "TRANSLATION" },
    })).json());
    const accepted = AcceptedMessageSchema.parse((await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      headers: { "idempotency-key": randomUUID() },
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
});
