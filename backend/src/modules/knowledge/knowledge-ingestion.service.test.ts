import { describe, expect, it, vi } from "vitest";
import { EmbeddingClient } from "./embedding.client.js";
import { KnowledgeIngestionService } from "./knowledge-ingestion.service.js";
import { knowledgeHash, publicPlaceText } from "./knowledge-text.js";

const source = {
  id: "11111111-1111-4111-8111-111111111111",
  placeId: "22222222-2222-4222-8222-222222222222",
  provider: "kakao",
  externalId: "123",
  sourceUrl: "https://place.map.kakao.com/123",
  fetchedAt: new Date("2026-09-16T10:00:00.000Z"),
  expiresAt: new Date("2026-09-17T10:00:00.000Z"),
  place: { name: "경복궁", nameZh: "景福宫", address: "서울 종로구", category: "문화유적" },
};

type MockPrisma = {
  placeSource: { findUnique: ReturnType<typeof vi.fn> };
  knowledgeDocument: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  knowledgeChunk: { upsert: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  knowledgeEmbedding: { upsert: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  $executeRaw: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
};

function prismaMock(existing: unknown = null): MockPrisma {
  return {
    placeSource: { findUnique: vi.fn().mockResolvedValue(source) },
    knowledgeDocument: {
      findUnique: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" }),
      update: vi.fn().mockResolvedValue({}),
    },
    knowledgeChunk: { upsert: vi.fn().mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444", content: "地点：景福宫" }) },
    knowledgeEmbedding: {
      upsert: vi.fn().mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555" }),
      create: vi.fn().mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555" }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn().mockImplementation(async (operations: unknown[]) => Promise.all(operations)),
  };
}

describe("KnowledgeIngestionService", () => {
  it("builds stable bilingual public place text", () => {
    const text = publicPlaceText({ ...source.place, provider: source.provider });
    expect(text).toContain("地点：경복궁");
    expect(text).toContain("中文名：景福宫");
    expect(knowledgeHash(text)).toHaveLength(64);
    expect(knowledgeHash(text)).toBe(knowledgeHash(text));
  });

  it("creates and embeds public knowledge without an owner", async () => {
    const prisma = prismaMock();
    const vector = [1, ...Array(1023).fill(0)] as number[];
    const embeddings = { embed: vi.fn().mockResolvedValue([vector]) };
    await new KnowledgeIngestionService(prisma as never, embeddings as unknown as EmbeddingClient).syncPublicPlace(source.id);
    const input = prisma.knowledgeDocument.upsert.mock.calls[0]?.[0];
    expect(input.create).toMatchObject({ kind: "OFFICIAL_FACT", visibility: "PUBLIC" });
    expect(input.create).not.toHaveProperty("userId");
    expect(input.create).not.toHaveProperty("guestId");
    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
  });

  it("only refreshes source metadata when ready content is unchanged", async () => {
    const content = publicPlaceText({ ...source.place, provider: source.provider });
    const prisma = prismaMock({ id: "33333333-3333-4333-8333-333333333333", contentHash: knowledgeHash(content), status: "READY" });
    const embeddings = { embed: vi.fn() };
    await new KnowledgeIngestionService(prisma as never, embeddings as unknown as EmbeddingClient).syncPublicPlace(source.id);
    expect(prisma.knowledgeDocument.update).toHaveBeenCalledOnce();
    expect(prisma.knowledgeDocument.upsert).not.toHaveBeenCalled();
    expect(embeddings.embed).not.toHaveBeenCalled();
  });

  it("records a retryable failure without deleting place knowledge", async () => {
    const prisma = prismaMock();
    const embeddings = { embed: vi.fn().mockRejectedValue(new Error("offline")) };
    await expect(new KnowledgeIngestionService(prisma as never, embeddings as unknown as EmbeddingClient).syncPublicPlace(source.id)).rejects.toThrow("offline");
    expect(prisma.knowledgeEmbedding.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", lastErrorCode: "EMBEDDING_FAILED" }) }));
    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "FAILED" } }));
  });

  it("stores selected guide experience for exactly one private owner", async () => {
    const prisma = prismaMock();
    const vector = [1, ...Array(1023).fill(0)] as number[];
    const embeddings = { embed: vi.fn().mockResolvedValue([vector]) };
    await new KnowledgeIngestionService(prisma as never, embeddings as unknown as EmbeddingClient).syncPrivateGuide({
      tripResourceId: "66666666-6666-4666-8666-666666666666",
      identity: { userId: null, guestId: "77777777-7777-4777-8777-777777777777" },
      externalId: "preview-1",
      sourceUrl: "https://xhslink.cn/example",
      title: "私人攻略：景福宫",
      chunks: [{ title: "景福宫", content: "地点：景福宫\n攻略经验：上午人少", metadata: { name: "景福宫" } }],
    });
    const input = prisma.knowledgeDocument.upsert.mock.calls[0]?.[0];
    expect(input.create).toMatchObject({ kind: "PERSONAL_EXPERIENCE", visibility: "PRIVATE", userId: null, guestId: "77777777-7777-4777-8777-777777777777" });
    expect(prisma.knowledgeChunk.create).toHaveBeenCalledOnce();
    expect(embeddings.embed).toHaveBeenCalledWith(["地点：景福宫"]);
  });

  it("rejects private knowledge without exactly one owner", async () => {
    const service = new KnowledgeIngestionService(prismaMock() as never, { embed: vi.fn() } as unknown as EmbeddingClient);
    await expect(service.syncPrivateGuide({ tripResourceId: source.id, identity: { userId: null, guestId: null }, externalId: "x", sourceUrl: null, title: "x", chunks: [{ title: "x", content: "x", metadata: {} }] })).rejects.toThrow("PRIVATE_KNOWLEDGE_OWNER_INVALID");
  });
});
