import { Injectable } from "@nestjs/common";
import { EmbeddingStatus, KnowledgeKind, KnowledgeStatus, KnowledgeVisibility, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { EmbeddingClient, EmbeddingClientError } from "./embedding.client.js";
import { knowledgeHash, publicPlaceText } from "./knowledge-text.js";
import type { Identity } from "../auth/identity.service.js";

export type PrivateGuideChunk = { title: string; content: string; metadata: Prisma.InputJsonObject };

@Injectable()
export class KnowledgeIngestionService {
  private readonly model = process.env.EMBEDDING_MODEL || "BAAI/bge-m3";
  private readonly modelVersion = process.env.EMBEDDING_MODEL_VERSION || "master";

  constructor(private readonly prisma: PrismaService, private readonly embeddings: EmbeddingClient) {}

  queuePublicPlace(placeSourceId: string): void {
    void this.syncPublicPlace(placeSourceId).catch(() => undefined);
  }

  queuePrivateGuide(input: { tripResourceId: string; identity: Identity; externalId: string; sourceUrl: string | null; title: string; chunks: PrivateGuideChunk[] }): void {
    void this.syncPrivateGuide(input).catch(() => undefined);
  }

  async syncPrivateGuide(input: { tripResourceId: string; identity: Identity; externalId: string; sourceUrl: string | null; title: string; chunks: PrivateGuideChunk[] }): Promise<string | null> {
    if (Boolean(input.identity.userId) === Boolean(input.identity.guestId)) throw new Error("PRIVATE_KNOWLEDGE_OWNER_INVALID");
    const chunks = input.chunks.filter((chunk) => chunk.content.trim()).slice(0, 30);
    if (chunks.length === 0) return null;
    const rawContent = chunks.map((chunk) => chunk.content.trim()).join("\n\n");
    const contentHash = knowledgeHash(rawContent);
    const existing = await this.prisma.knowledgeDocument.findUnique({ where: { tripResourceId: input.tripResourceId } });
    if (existing?.contentHash === contentHash && existing.status === KnowledgeStatus.READY) return existing.id;
    const document = await this.prisma.knowledgeDocument.upsert({
      where: { tripResourceId: input.tripResourceId },
      create: {
        kind: KnowledgeKind.PERSONAL_EXPERIENCE,
        visibility: KnowledgeVisibility.PRIVATE,
        userId: input.identity.userId,
        guestId: input.identity.guestId,
        tripResourceId: input.tripResourceId,
        provider: "user-guide",
        externalId: input.externalId,
        sourceUrl: input.sourceUrl,
        title: input.title,
        rawContent,
        contentHash,
        status: KnowledgeStatus.PENDING,
      },
      update: { sourceUrl: input.sourceUrl, title: input.title, rawContent, contentHash, status: KnowledgeStatus.PENDING },
    });
    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId: document.id } });
    const records = [];
    for (const [sequence, value] of chunks.entries()) {
      const content = value.content.trim();
      const chunk = await this.prisma.knowledgeChunk.create({ data: { documentId: document.id, sequence, content, metadata: value.metadata, tokenCount: Math.ceil(content.length / 2), contentHash: knowledgeHash(content) } });
      const embedding = await this.prisma.knowledgeEmbedding.create({ data: { chunkId: chunk.id, model: this.model, modelVersion: this.modelVersion, dimensions: 1024, status: EmbeddingStatus.PENDING } });
      records.push({ chunk, embedding });
    }
    try {
      const vectors = await this.embeddings.embed(records.map(({ chunk }) => chunk.content));
      for (const [index, record] of records.entries()) {
        const vector = vectors[index];
        if (!vector) throw new EmbeddingClientError("EMBEDDING_INVALID_RESPONSE");
        await this.prisma.$executeRaw(Prisma.sql`UPDATE "KnowledgeEmbedding" SET "embedding" = ${JSON.stringify(vector)}::vector WHERE "id" = ${record.embedding.id}::uuid`);
        await this.prisma.knowledgeEmbedding.update({ where: { id: record.embedding.id }, data: { status: EmbeddingStatus.READY, embeddedAt: new Date(), attempts: { increment: 1 }, lastErrorCode: null } });
      }
      await this.prisma.knowledgeDocument.update({ where: { id: document.id }, data: { status: KnowledgeStatus.READY } });
    } catch (error) {
      const code = error instanceof EmbeddingClientError ? error.code : "EMBEDDING_FAILED";
      await this.prisma.$transaction([
        this.prisma.knowledgeEmbedding.updateMany({ where: { id: { in: records.map(({ embedding }) => embedding.id) } }, data: { status: EmbeddingStatus.FAILED, attempts: { increment: 1 }, lastErrorCode: code } }),
        this.prisma.knowledgeDocument.update({ where: { id: document.id }, data: { status: KnowledgeStatus.FAILED } }),
      ]);
      throw error;
    }
    return document.id;
  }

  async syncPublicPlace(placeSourceId: string): Promise<string | null> {
    const source = await this.prisma.placeSource.findUnique({ where: { id: placeSourceId }, include: { place: true } });
    if (!source) return null;
    const content = publicPlaceText({ ...source.place, provider: source.provider });
    const contentHash = knowledgeHash(content);
    const existing = await this.prisma.knowledgeDocument.findUnique({ where: { placeSourceId } });
    if (existing?.contentHash === contentHash && existing.status === KnowledgeStatus.READY) {
      await this.prisma.knowledgeDocument.update({
        where: { id: existing.id },
        data: { title: source.place.nameZh ?? source.place.name, sourceUrl: source.sourceUrl, sourceFetchedAt: source.fetchedAt, sourceExpiresAt: source.expiresAt },
      });
      return existing.id;
    }

    const document = await this.prisma.knowledgeDocument.upsert({
      where: { placeSourceId },
      create: {
        kind: KnowledgeKind.OFFICIAL_FACT,
        visibility: KnowledgeVisibility.PUBLIC,
        placeSourceId,
        provider: source.provider,
        externalId: source.externalId,
        sourceUrl: source.sourceUrl,
        title: source.place.nameZh ?? source.place.name,
        rawContent: content,
        sourceFetchedAt: source.fetchedAt,
        sourceExpiresAt: source.expiresAt,
        contentHash,
        status: KnowledgeStatus.PENDING,
      },
      update: {
        provider: source.provider,
        externalId: source.externalId,
        sourceUrl: source.sourceUrl,
        title: source.place.nameZh ?? source.place.name,
        rawContent: content,
        sourceFetchedAt: source.fetchedAt,
        sourceExpiresAt: source.expiresAt,
        contentHash,
        status: KnowledgeStatus.PENDING,
      },
    });
    const chunk = await this.prisma.knowledgeChunk.upsert({
      where: { documentId_sequence: { documentId: document.id, sequence: 0 } },
      create: { documentId: document.id, sequence: 0, content, metadata: { placeId: source.placeId, provider: source.provider }, tokenCount: Math.ceil(content.length / 2), contentHash },
      update: { content, metadata: { placeId: source.placeId, provider: source.provider }, tokenCount: Math.ceil(content.length / 2), contentHash },
    });
    const embedding = await this.prisma.knowledgeEmbedding.upsert({
      where: { chunkId_model_modelVersion: { chunkId: chunk.id, model: this.model, modelVersion: this.modelVersion } },
      create: { chunkId: chunk.id, model: this.model, modelVersion: this.modelVersion, dimensions: 1024, status: EmbeddingStatus.PENDING },
      update: { status: EmbeddingStatus.PENDING, lastErrorCode: null },
    });

    try {
      const [vector] = await this.embeddings.embed([content]);
      if (!vector) throw new EmbeddingClientError("EMBEDDING_INVALID_RESPONSE");
      const literal = JSON.stringify(vector);
      await this.prisma.$executeRaw(Prisma.sql`UPDATE "KnowledgeEmbedding" SET "embedding" = ${literal}::vector WHERE "id" = ${embedding.id}::uuid`);
      await this.prisma.$transaction([
        this.prisma.knowledgeEmbedding.update({ where: { id: embedding.id }, data: { status: EmbeddingStatus.READY, embeddedAt: new Date(), attempts: { increment: 1 }, lastErrorCode: null } }),
        this.prisma.knowledgeDocument.update({ where: { id: document.id }, data: { status: KnowledgeStatus.READY } }),
      ]);
    } catch (error) {
      const code = error instanceof EmbeddingClientError ? error.code : "EMBEDDING_FAILED";
      await this.prisma.$transaction([
        this.prisma.knowledgeEmbedding.update({ where: { id: embedding.id }, data: { status: EmbeddingStatus.FAILED, attempts: { increment: 1 }, lastErrorCode: code } }),
        this.prisma.knowledgeDocument.update({ where: { id: document.id }, data: { status: KnowledgeStatus.FAILED } }),
      ]);
      throw error;
    }
    return document.id;
  }
}
