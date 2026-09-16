import { Injectable, NotFoundException } from "@nestjs/common";
import { SavedPlaceSchema, type SavedPlace } from "@koreamate/contracts";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { Identity } from "../auth/identity.service.js";

const includePlace = {
  place: { include: { sources: { orderBy: { fetchedAt: "desc" as const }, take: 1 } } },
};

@Injectable()
export class SavedPlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(identity: Identity): Promise<{ items: SavedPlace[] }> {
    const records = await this.prisma.savedPlace.findMany({
      where: this.owner(identity),
      orderBy: { createdAt: "desc" },
      include: includePlace,
    });
    return { items: records.map((record) => this.toContract(record)) };
  }

  async create(identity: Identity, placeId: string, note?: string | null): Promise<SavedPlace> {
    if (!await this.prisma.place.findUnique({ where: { id: placeId }, select: { id: true } })) {
      throw new NotFoundException("Place not found");
    }
    const owner = this.ownerData(identity);
    const existing = await this.prisma.savedPlace.findFirst({ where: { placeId, ...owner }, include: includePlace });
    if (existing) return this.toContract(existing);
    const record = await this.prisma.savedPlace.create({ data: { placeId, note: note || null, ...owner }, include: includePlace });
    return this.toContract(record);
  }

  async update(identity: Identity, id: string, note: string | null): Promise<SavedPlace> {
    const existing = await this.prisma.savedPlace.findFirst({ where: { id, ...this.owner(identity) } });
    if (!existing) throw new NotFoundException("Saved place not found");
    return this.toContract(await this.prisma.savedPlace.update({ where: { id }, data: { note: note || null }, include: includePlace }));
  }

  async remove(identity: Identity, id: string): Promise<void> {
    const result = await this.prisma.savedPlace.deleteMany({ where: { id, ...this.owner(identity) } });
    if (result.count === 0) throw new NotFoundException("Saved place not found");
  }

  private owner(identity: Identity): Prisma.SavedPlaceWhereInput {
    if (identity.userId) return { userId: identity.userId };
    if (identity.guestId) return { guestId: identity.guestId };
    return { id: "00000000-0000-0000-0000-000000000000" };
  }

  private ownerData(identity: Identity): { userId: string } | { guestId: string } {
    if (identity.userId) return { userId: identity.userId };
    if (identity.guestId) return { guestId: identity.guestId };
    throw new NotFoundException("Identity not found");
  }

  private toContract(record: Prisma.SavedPlaceGetPayload<{ include: typeof includePlace }>): SavedPlace {
    const source = record.place.sources[0];
    return SavedPlaceSchema.parse({
      id: record.id,
      placeId: record.placeId,
      name: record.place.name,
      nameZh: record.place.nameZh,
      address: record.place.address,
      latitude: Number(record.place.latitude),
      longitude: Number(record.place.longitude),
      mapUrl: source?.sourceUrl ?? null,
      note: record.note,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });
  }
}
