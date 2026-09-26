import { Injectable, NotFoundException } from "@nestjs/common";
import { UserMemorySchema, type MemoryCandidate, type MemoryKind, type UserMemory } from "@koreamate/contracts";
import type { Prisma, UserMemory as UserMemoryRow } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { Identity } from "../auth/identity.service.js";

const singleKinds: MemoryKind[] = ["departure_city", "budget_level", "pace"];
const kindOrder: Record<MemoryKind, number> = { departure_city: 0, budget_level: 1, pace: 2, interest: 3, constraint: 4 };

@Injectable()
export class MemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(identity: Identity): Promise<{ items: UserMemory[] }> {
    const rows = await this.prisma.userMemory.findMany({ where: this.owner(identity), orderBy: { updatedAt: "desc" } });
    return { items: rows.map((row) => this.toContract(row)).sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]) };
  }

  async upsertCandidates(identity: Identity, candidates: MemoryCandidate[], sourceMessageId?: string): Promise<UserMemory[]> {
    const owner = this.ownerData(identity);
    return this.prisma.$transaction(async (transaction) => {
      const saved: UserMemoryRow[] = [];
      for (const candidate of candidates.filter((item) => item.confidence >= 0.8)) {
        const value = candidate.value.trim();
        const normalizedValue = this.normalize(candidate.kind, value);
        if (singleKinds.includes(candidate.kind)) {
          await transaction.userMemory.deleteMany({ where: { kind: candidate.kind, ...owner } });
        } else {
          const existing = await transaction.userMemory.findFirst({ where: { kind: candidate.kind, normalizedValue, ...owner } });
          if (existing) {
            saved.push(await transaction.userMemory.update({ where: { id: existing.id }, data: { value, confidence: candidate.confidence, sourceMessageId } }));
            continue;
          }
        }
        saved.push(await transaction.userMemory.create({ data: { kind: candidate.kind, value, normalizedValue, confidence: candidate.confidence, sourceMessageId, ...owner } }));
      }
      return saved.map((row) => this.toContract(row));
    });
  }

  async remove(identity: Identity, id: string): Promise<void> {
    await this.prisma.userMemory.deleteMany({ where: { id, ...this.owner(identity) } });
  }

  private normalize(kind: MemoryKind, value: string): string {
    const normalized = value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
    return kind === "pace" || kind === "budget_level" ? normalized.replace(/\s+/g, "_") : normalized.replace(/\s+/g, "");
  }

  private owner(identity: Identity): Prisma.UserMemoryWhereInput {
    if (identity.userId) return { userId: identity.userId };
    if (identity.guestId) return { guestId: identity.guestId };
    return { id: "00000000-0000-0000-0000-000000000000" };
  }

  private ownerData(identity: Identity): { userId: string } | { guestId: string } {
    if (identity.userId) return { userId: identity.userId };
    if (identity.guestId) return { guestId: identity.guestId };
    throw new NotFoundException("Identity not found");
  }

  private toContract(row: { id: string; kind: MemoryKind; value: string; confidence: unknown; createdAt: Date; updatedAt: Date }): UserMemory {
    return UserMemorySchema.parse({ id: row.id, kind: row.kind, value: row.value, confidence: Number(row.confidence), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  }
}
