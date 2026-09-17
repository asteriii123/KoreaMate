import { Controller, Get, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { EmbeddingClient } from "./embed.js";
import { KnowledgeBackfillService, type KnowledgeBackfillResult } from "./backfill.js";

@Controller("internal/knowledge")
export class KnowledgeController {
  constructor(private readonly prisma: PrismaService, private readonly embeddings: EmbeddingClient, private readonly backfill: KnowledgeBackfillService) {}

  @Get("status")
  async status(@Headers("x-internal-key") provided?: string): Promise<unknown> {
    this.authorize(provided);
    const [documents, embedding] = await Promise.all([
      this.prisma.knowledgeDocument.groupBy({ by: ["status"], _count: { _all: true } }),
      this.embeddings.health(),
    ]);
    const counts = { ready: 0, pending: 0, failed: 0, deleted: 0 };
    for (const row of documents) counts[row.status.toLowerCase() as keyof typeof counts] = row._count._all;
    return { documents: counts, model: embedding.model, modelVersion: embedding.modelVersion, embedding };
  }

  @Post("backfill")
  async runBackfill(@Headers("x-internal-key") provided?: string): Promise<KnowledgeBackfillResult> {
    this.authorize(provided);
    return this.backfill.run();
  }

  private authorize(provided?: string): void {
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected || provided !== expected) throw new UnauthorizedException("Internal endpoint unavailable");
  }
}
