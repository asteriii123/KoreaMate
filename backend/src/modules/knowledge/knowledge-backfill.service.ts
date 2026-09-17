import { Injectable } from "@nestjs/common";
import { KnowledgeStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { KnowledgeIngestionService } from "./knowledge-ingestion.service.js";

export type KnowledgeBackfillResult = { attempted: number; succeeded: number; failed: number; remaining: number };

@Injectable()
export class KnowledgeBackfillService {
  constructor(private readonly prisma: PrismaService, private readonly ingestion: KnowledgeIngestionService) {}

  async run(batchSize = 25): Promise<KnowledgeBackfillResult> {
    const take = Math.max(1, Math.min(100, batchSize));
    const where = {
      OR: [
        { knowledgeDocument: { is: null } },
        { knowledgeDocument: { is: { status: KnowledgeStatus.FAILED } } },
      ],
    };
    const sources = await this.prisma.placeSource.findMany({ where, orderBy: { id: "asc" }, take, select: { id: true } });
    let succeeded = 0;
    let failed = 0;
    for (const source of sources) {
      try {
        await this.ingestion.syncPublicPlace(source.id);
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
    const remaining = await this.prisma.placeSource.count({ where });
    return { attempted: sources.length, succeeded, failed, remaining };
  }
}
