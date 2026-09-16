import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserMemoryListSchema } from "@koreamate/contracts";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/modules/database/prisma.service.js";
import { MemoryService } from "../src/modules/memory/memory.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:55432/koreamate_v3";

describe("travel memory", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let memories: MemoryService;
  let guestId: string;
  let cookie: string;

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
});
