import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { EmbeddingClient } from "./embedding.client.js";
import { KnowledgeSearchService } from "./knowledge-search.service.js";

const vector = [1, ...Array(1023).fill(0)] as number[];
const official = {
  chunkId: "11111111-1111-4111-8111-111111111111",
  kind: "OFFICIAL_FACT" as const,
  title: "경복궁 / 景福宫",
  content: "地点：경복궁\n中文名：景福宫",
  contentHash: "a".repeat(64),
  provider: "kakao",
  sourceUrl: "https://place.map.kakao.com/1",
  fetchedAt: new Date("2026-09-17T00:00:00.000Z"),
  expiresAt: new Date("2026-09-18T00:00:00.000Z"),
  score: 0.91,
};

type TestSetup = {
  prisma: { $queryRaw: ReturnType<typeof vi.fn> };
  embeddings: { embed: ReturnType<typeof vi.fn> };
  service: KnowledgeSearchService;
};

function setup(results: unknown[] = [[official], []]): TestSetup {
  const prisma = { $queryRaw: vi.fn() };
  for (const result of results) prisma.$queryRaw.mockResolvedValueOnce(result);
  const embeddings = { embed: vi.fn().mockResolvedValue([vector]) };
  return { prisma, embeddings, service: new KnowledgeSearchService(prisma as never, embeddings as unknown as EmbeddingClient) };
}

describe("KnowledgeSearchService", () => {
  it("retrieves official and owner-private knowledge independently", async () => {
    const personal = { ...official, chunkId: "22222222-2222-4222-8222-222222222222", kind: "PERSONAL_EXPERIENCE" as const, contentHash: "b".repeat(64), provider: "user-guide", sourceUrl: null, fetchedAt: null, expiresAt: null, score: 0.8 };
    const { prisma, service } = setup([[official], [personal]]);
    const result = await service.search("景福宫怎么玩", { userId: "33333333-3333-4333-8333-333333333333", guestId: null });
    expect(result.officialFacts).toHaveLength(1);
    expect(result.personalExperiences).toHaveLength(1);
    expect(result.personalExperiences[0]?.trust).toBe("assistant_suggestion");
    const privateSql = prisma.$queryRaw.mock.calls[1]?.[0] as Prisma.Sql;
    expect(privateSql.values).toContain("33333333-3333-4333-8333-333333333333");
  });

  it("does not query private knowledge for an anonymous identity", async () => {
    const { prisma, service } = setup([[official]]);
    const result = await service.search("경복궁", { userId: null, guestId: null });
    expect(result.personalExperiences).toEqual([]);
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it("deduplicates content, applies stale penalty, and drops weak rows", async () => {
    const stale = { ...official, expiresAt: new Date("2020-01-01T00:00:00.000Z"), score: 0.6 };
    const duplicate = { ...official, chunkId: "44444444-4444-4444-8444-444444444444", score: 0.9 };
    const weak = { ...official, chunkId: "55555555-5555-4555-8555-555555555555", contentHash: "c".repeat(64), score: 0.4 };
    const { service } = setup([[stale, duplicate, weak], []]);
    const result = await service.search("景福宫", { userId: "33333333-3333-4333-8333-333333333333", guestId: null });
    expect(result.officialFacts).toHaveLength(1);
    expect(result.officialFacts[0]).toMatchObject({ stale: true, score: 0.51 });
  });

  it("returns an empty context when embedding or database lookup fails", async () => {
    const { embeddings, service } = setup();
    embeddings.embed.mockRejectedValueOnce(new Error("offline"));
    await expect(service.search("景福宫", { userId: null, guestId: "66666666-6666-4666-8666-666666666666" })).resolves.toEqual({ officialFacts: [], personalExperiences: [] });
  });

  it("normalizes legacy Kakao HTTP links without dropping the result", async () => {
    const { service } = setup([[{ ...official, sourceUrl: "http://place.map.kakao.com/1" }], []]);
    const result = await service.search("景福宫", { userId: "33333333-3333-4333-8333-333333333333", guestId: null });
    expect(result.officialFacts[0]?.sourceUrl).toBe("https://place.map.kakao.com/1");
  });
});
