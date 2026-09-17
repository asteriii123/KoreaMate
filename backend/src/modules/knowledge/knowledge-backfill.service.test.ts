import { describe, expect, it, vi } from "vitest";
import type { KnowledgeIngestionService } from "./knowledge-ingestion.service.js";
import { KnowledgeBackfillService } from "./knowledge-backfill.service.js";

describe("KnowledgeBackfillService", () => {
  it("continues a batch when one source fails", async () => {
    const prisma = {
      placeSource: {
        findMany: vi.fn().mockResolvedValue([{ id: "source-1" }, { id: "source-2" }]),
        count: vi.fn().mockResolvedValue(3),
      },
    };
    const ingestion = { syncPublicPlace: vi.fn().mockResolvedValueOnce("document-1").mockRejectedValueOnce(new Error("embedding offline")) };
    const result = await new KnowledgeBackfillService(prisma as never, ingestion as unknown as KnowledgeIngestionService).run(2);
    expect(result).toEqual({ attempted: 2, succeeded: 1, failed: 1, remaining: 3 });
    expect(ingestion.syncPublicPlace).toHaveBeenCalledTimes(2);
  });

  it("caps the requested batch size", async () => {
    const prisma = { placeSource: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) } };
    const service = new KnowledgeBackfillService(prisma as never, { syncPublicPlace: vi.fn() } as unknown as KnowledgeIngestionService);
    await service.run(1_000);
    expect(prisma.placeSource.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });
});
