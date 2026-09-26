import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserMemoryListSchema } from "@koreamate/contracts";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/database/prisma.service.js";
import { MemoryService } from "../src/memory/memory.service.js";
import { IdentityService } from "../src/auth/identity.service.js";
import type { FastifyReply } from "fastify";
import { KnowledgeKind, KnowledgeStatus, KnowledgeVisibility } from "@prisma/client";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:55432/koreamate_v3";

describe("travel memory", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let memories: MemoryService;
  let guestId: string;
  let cookie: string;
  let userId: string | null = null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);
    memories = app.get(MemoryService);
    const response = await app.inject({ method: "GET", url: "/api/v1/memories" });
    const header = response.headers["set-cookie"];
    cookie = (Array.isArray(header) ? header[0] : header) ?? "";
    guestId = (await prisma.guestIdentity.findFirstOrThrow({ orderBy: { createdAt: "desc" } })).id;
  });

  afterAll(async () => {
    await prisma.userMemory.deleteMany({ where: { guestId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.guestIdentity.deleteMany({ where: { id: guestId } });
    await app.close();
  });

  it("replaces single values, deduplicates multiple values, and isolates guests", async () => {
    const identity = { userId: null, guestId };
    await memories.upsertCandidates(identity, [{ kind: "departure_city", value: "成都", confidence: 0.95 }]);
    await memories.upsertCandidates(identity, [{ kind: "departure_city", value: "上海", confidence: 0.96 }]);
    await memories.upsertCandidates(identity, [{ kind: "interest", value: "咖啡店", confidence: 0.9 }, { kind: "interest", value: " 咖啡店 ", confidence: 0.91 }]);

    const own = UserMemoryListSchema.parse((await app.inject({ method: "GET", url: "/api/v1/memories", headers: { cookie } })).json());
    expect(own.items.map((item) => item.value)).toEqual(["上海", "咖啡店"]);
    const other = UserMemoryListSchema.parse((await app.inject({ method: "GET", url: "/api/v1/memories" })).json());
    expect(other.items).toHaveLength(0);

    const forbidden = await app.inject({ method: "DELETE", url: `/api/v1/memories/${own.items[0]?.id}` });
    expect(forbidden.statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/api/v1/memories/${own.items[0]?.id}`, headers: { cookie } })).statusCode).toBe(200);
  });

  it("merges guest memories into an account without replacing account single values", async () => {
    const user = await prisma.user.create({ data: { email: `memory-${Date.now()}@example.com` } });
    userId = user.id;
    await memories.upsertCandidates({ userId, guestId: null }, [{ kind: "pace", value: "balanced", confidence: 0.9 }]);
    await memories.upsertCandidates({ userId: null, guestId }, [{ kind: "pace", value: "relaxed", confidence: 0.95 }, { kind: "constraint", value: "不吃辣", confidence: 0.98 }]);
    const conversation = await prisma.conversation.create({ data: { mode: "TRAVEL", guestId } });
    const trip = await prisma.trip.create({ data: { conversationId: conversation.id } });
    const resource = await prisma.tripResource.create({ data: { tripId: trip.id, kind: "guide-import", provider: "llm+kakao", query: {}, data: {}, expiresAt: new Date(Date.now() + 60_000) } });
    const document = await prisma.knowledgeDocument.create({ data: { kind: KnowledgeKind.PERSONAL_EXPERIENCE, visibility: KnowledgeVisibility.PRIVATE, guestId, tripResourceId: resource.id, provider: "user-guide", externalId: `memory-${Date.now()}`, title: "私人攻略", rawContent: "上午去景福宫", contentHash: "a".repeat(64), status: KnowledgeStatus.PENDING } });
    const headers = new Map<string, string | string[]>();
    const reply = { raw: { getHeader: (name: string) => headers.get(name), setHeader: (name: string, value: string | string[]) => headers.set(name, value) } } as unknown as FastifyReply;
    await app.get(IdentityService).createSession(userId, guestId, reply);
    const merged = await memories.list({ userId, guestId: null });
    expect(merged.items.map((item) => item.value)).toEqual(["balanced", "咖啡店", "不吃辣"]);
    expect(await prisma.userMemory.count({ where: { guestId } })).toBe(0);
    expect(await prisma.knowledgeDocument.findUnique({ where: { id: document.id } })).toMatchObject({ userId, guestId: null });
  });
});
