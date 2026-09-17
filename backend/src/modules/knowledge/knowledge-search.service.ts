import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TravelKnowledgeContextSchema, type KnowledgeReference, type TravelKnowledgeContext } from "@koreamate/contracts";
import type { Identity } from "../auth/identity.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { EmbeddingClient } from "./embedding.client.js";

type SearchRow = {
  chunkId: string;
  kind: "OFFICIAL_FACT" | "PERSONAL_EXPERIENCE";
  title: string;
  content: string;
  contentHash: string;
  provider: string;
  sourceUrl: string | null;
  fetchedAt: Date | null;
  expiresAt: Date | null;
  score: number;
};

const EMPTY_CONTEXT: TravelKnowledgeContext = { officialFacts: [], personalExperiences: [] };

@Injectable()
export class KnowledgeSearchService {
  private readonly model = process.env.EMBEDDING_MODEL || "BAAI/bge-m3";
  private readonly modelVersion = process.env.EMBEDDING_MODEL_VERSION || "master";
  private readonly minimumScore = 0.42;

  constructor(private readonly prisma: PrismaService, private readonly embeddings: EmbeddingClient) {}

  async search(query: string, identity: Identity): Promise<TravelKnowledgeContext> {
    const normalized = query.trim().slice(0, 4_096);
    if (!normalized) return EMPTY_CONTEXT;
    try {
      const [vector] = await this.embeddings.embed([normalized]);
      if (!vector) return EMPTY_CONTEXT;
      const vectorValue = JSON.stringify(vector);
      const [officialRows, privateRows] = await Promise.all([
        this.prisma.$queryRaw<SearchRow[]>(this.officialQuery(vectorValue)),
        this.privateQuery(vectorValue, identity),
      ]);
      return TravelKnowledgeContextSchema.parse({
        officialFacts: this.references(officialRows, 6),
        personalExperiences: this.references(privateRows, 4),
      });
    } catch {
      return EMPTY_CONTEXT;
    }
  }

  private officialQuery(vector: string): Prisma.Sql {
    return Prisma.sql`
      SELECT c."id" AS "chunkId", d."kind", d."title", c."content", c."contentHash",
             d."provider", d."sourceUrl", d."sourceFetchedAt" AS "fetchedAt",
             d."sourceExpiresAt" AS "expiresAt",
             GREATEST(0, 1 - (e."embedding" <=> ${vector}::vector))::float8 AS "score"
      FROM "KnowledgeEmbedding" e
      JOIN "KnowledgeChunk" c ON c."id" = e."chunkId"
      JOIN "KnowledgeDocument" d ON d."id" = c."documentId"
      WHERE d."visibility" = 'PUBLIC' AND d."kind" = 'OFFICIAL_FACT'
        AND d."status" = 'READY' AND e."status" = 'READY'
        AND e."model" = ${this.model} AND e."modelVersion" = ${this.modelVersion}
        AND 1 - (e."embedding" <=> ${vector}::vector) >= ${this.minimumScore}
      ORDER BY e."embedding" <=> ${vector}::vector
      LIMIT 12`;
  }

  private privateQuery(vector: string, identity: Identity): Promise<SearchRow[]> {
    if (!identity.userId && !identity.guestId) return Promise.resolve([]);
    const owner = identity.userId
      ? Prisma.sql`d."userId" = ${identity.userId}::uuid`
      : Prisma.sql`d."guestId" = ${identity.guestId}::uuid`;
    return this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT c."id" AS "chunkId", d."kind", d."title", c."content", c."contentHash",
             d."provider", d."sourceUrl", d."sourceFetchedAt" AS "fetchedAt",
             d."sourceExpiresAt" AS "expiresAt",
             GREATEST(0, 1 - (e."embedding" <=> ${vector}::vector))::float8 AS "score"
      FROM "KnowledgeEmbedding" e
      JOIN "KnowledgeChunk" c ON c."id" = e."chunkId"
      JOIN "KnowledgeDocument" d ON d."id" = c."documentId"
      WHERE d."visibility" = 'PRIVATE' AND d."kind" = 'PERSONAL_EXPERIENCE'
        AND ${owner}
        AND d."status" = 'READY' AND e."status" = 'READY'
        AND e."model" = ${this.model} AND e."modelVersion" = ${this.modelVersion}
        AND 1 - (e."embedding" <=> ${vector}::vector) >= ${this.minimumScore}
      ORDER BY e."embedding" <=> ${vector}::vector
      LIMIT 8`);
  }

  private references(rows: SearchRow[], limit: number): KnowledgeReference[] {
    const seen = new Set<string>();
    return rows.flatMap((row) => {
      if (seen.has(row.contentHash)) return [];
      seen.add(row.contentHash);
      const stale = Boolean(row.expiresAt && row.expiresAt.getTime() < Date.now());
      const score = Math.max(0, Math.min(1, row.score * (stale ? 0.85 : 1)));
      if (score < this.minimumScore) return [];
      return [{
        chunkId: row.chunkId,
        kind: row.kind === "OFFICIAL_FACT" ? "official_fact" as const : "personal_experience" as const,
        trust: row.kind === "OFFICIAL_FACT" ? "verified" as const : "assistant_suggestion" as const,
        title: row.title,
        content: row.content.slice(0, 1_200),
        provider: row.provider,
        sourceUrl: row.sourceUrl,
        fetchedAt: row.fetchedAt?.toISOString() ?? null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        stale,
        score,
      }];
    }).slice(0, limit);
  }
}
