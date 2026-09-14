import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { PlaceResult } from "@koreamate/contracts";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { ExternalPlace, PlaceProvider } from "./place-provider.js";
import { PlaceProviderNotConfiguredError } from "./place-provider.js";
import { ProviderRegistryService } from "./provider-registry.service.js";

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService, private readonly registry: ProviderRegistryService) {}

  async search(query: string, requestedProvider?: string): Promise<PlaceResult[]> {
    const providers = this.registry.placeProviders().filter((provider) => !requestedProvider || provider.id === requestedProvider);
    if (providers.length === 0) throw new ServiceUnavailableException("Unknown place provider");
    for (const provider of providers) {
      if (!provider.configured) continue;
      const results = await this.call(provider, query);
      if (results.length > 0) return Promise.all(results.map((result) => this.persist(result)));
    }
    throw new ServiceUnavailableException("No configured place provider returned results");
  }

  private async call(provider: PlaceProvider, query: string): Promise<ExternalPlace[]> {
    const startedAt = Date.now();
    try {
      const results = await provider.search(query);
      await this.prisma.providerCall.create({ data: { provider: provider.id, operation: "place.search", status: "SUCCEEDED", durationMs: Date.now() - startedAt, request: { query }, response: { resultCount: results.length } } });
      return results;
    } catch (error) {
      const code = error instanceof PlaceProviderNotConfiguredError ? "NOT_CONFIGURED" : "PROVIDER_FAILED";
      await this.prisma.providerCall.create({ data: { provider: provider.id, operation: "place.search", status: "FAILED", durationMs: Date.now() - startedAt, errorCode: code, request: { query } } });
      if (error instanceof PlaceProviderNotConfiguredError) return [];
      throw new ServiceUnavailableException(`${provider.id} place search failed`);
    }
  }

  private async persist(result: ExternalPlace): Promise<PlaceResult> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000);
    const raw = JSON.parse(JSON.stringify(result.raw)) as Prisma.InputJsonValue;
    const existing = await this.prisma.placeSource.findUnique({ where: { provider_externalId: { provider: result.provider, externalId: result.externalId } }, include: { place: true } });
    const place = existing
      ? await this.prisma.place.update({ where: { id: existing.placeId }, data: { name: result.name, normalizedName: this.normalize(result.name), address: result.address, latitude: result.latitude, longitude: result.longitude, category: result.category } })
      : await this.prisma.place.create({ data: { name: result.name, normalizedName: this.normalize(result.name), address: result.address, latitude: result.latitude, longitude: result.longitude, category: result.category } });
    const source = await this.prisma.placeSource.upsert({
      where: { provider_externalId: { provider: result.provider, externalId: result.externalId } },
      create: { placeId: place.id, provider: result.provider, externalId: result.externalId, sourceUrl: result.sourceUrl, raw, expiresAt },
      update: { placeId: place.id, sourceUrl: result.sourceUrl, raw, fetchedAt: new Date(), expiresAt },
    });
    return { id: place.id, name: place.name, address: place.address, latitude: Number(place.latitude), longitude: Number(place.longitude), category: place.category, provider: result.provider, sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt.toISOString(), expiresAt: source.expiresAt.toISOString() };
  }

  private normalize(name: string): string {
    return name.normalize("NFKC").trim().toLocaleLowerCase("ko-KR");
  }
}
