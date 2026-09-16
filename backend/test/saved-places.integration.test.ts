import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SavedPlaceListSchema, SavedPlaceSchema } from "@koreamate/contracts";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/modules/database/prisma.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:55432/koreamate_v3";

describe("saved places", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let placeId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);
    const place = await prisma.place.create({
      data: { name: "경복궁", nameZh: "景福宫", normalizedName: "경복궁", address: "서울 종로구", latitude: 37.5796, longitude: 126.9769, sources: { create: { provider: "kakao", externalId: `saved-test-${Date.now()}`, sourceUrl: "https://place.map.kakao.com/1", raw: {}, expiresAt: new Date(Date.now() + 86_400_000) } } },
    });
    placeId = place.id;
  });

  afterAll(async () => {
    await prisma.place.deleteMany({ where: { id: placeId } });
    await app.close();
  });

  it("creates idempotently and isolates guest collections", async () => {
    const first = await app.inject({ method: "POST", url: "/api/v1/saved-places", payload: { placeId, note: "秋天去" } });
    expect(first.statusCode).toBe(201);
    const cookieHeader = first.headers["set-cookie"];
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
    const saved = SavedPlaceSchema.parse(first.json());
    expect(saved).toMatchObject({ placeId, name: "경복궁", nameZh: "景福宫", note: "秋天去" });

    const duplicate = await app.inject({ method: "POST", url: "/api/v1/saved-places", headers: { cookie }, payload: { placeId } });
    expect(SavedPlaceSchema.parse(duplicate.json()).id).toBe(saved.id);
    expect(await prisma.savedPlace.count({ where: { placeId } })).toBe(1);

    const ownList = SavedPlaceListSchema.parse((await app.inject({ method: "GET", url: "/api/v1/saved-places", headers: { cookie } })).json());
    expect(ownList.items).toHaveLength(1);
    const otherList = SavedPlaceListSchema.parse((await app.inject({ method: "GET", url: "/api/v1/saved-places" })).json());
    expect(otherList.items).toHaveLength(0);

    const forbiddenDelete = await app.inject({ method: "DELETE", url: `/api/v1/saved-places/${saved.id}` });
    expect(forbiddenDelete.statusCode).toBe(404);
    const removed = await app.inject({ method: "DELETE", url: `/api/v1/saved-places/${saved.id}`, headers: { cookie } });
    expect(removed.statusCode).toBe(200);
    expect(await prisma.place.findUnique({ where: { id: placeId } })).not.toBeNull();
  });
});
