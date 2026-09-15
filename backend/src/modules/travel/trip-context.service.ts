import { Injectable } from "@nestjs/common";
import type { ExchangeRateContext, WeatherContext } from "@koreamate/contracts";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { FrankfurterExchangeProvider } from "./frankfurter-exchange.provider.js";
import { OpenMeteoWeatherProvider } from "./open-meteo-weather.provider.js";

export type TripContext = { weather: WeatherContext | null; exchangeRate: ExchangeRateContext | null };

@Injectable()
export class TripContextService {
  constructor(private readonly prisma: PrismaService, private readonly weather: OpenMeteoWeatherProvider, private readonly exchange: FrankfurterExchangeProvider) {}

  async load(input: { tripId: string; latitude: number | null; longitude: number | null; startDate: string | null; tripDays: number; currency: string; today: string }): Promise<TripContext> {
    const weather = input.latitude === null || input.longitude === null
      ? null
      : await this.capture(input.tripId, "weather", "open-meteo", { latitude: input.latitude, longitude: input.longitude, startDate: input.startDate, tripDays: input.tripDays }, 60 * 60 * 1_000,
        () => this.weather.forecast({ latitude: input.latitude!, longitude: input.longitude!, startDate: input.startDate, tripDays: input.tripDays, today: input.today }));
    const exchangeRate = input.currency === "KRW"
      ? null
      : await this.capture(input.tripId, "exchange-rate", "frankfurter", { base: input.currency, quote: "KRW" }, 24 * 60 * 60 * 1_000, () => this.exchange.latest(input.currency));
    return { weather, exchangeRate };
  }

  private async capture<T>(tripId: string, kind: string, provider: string, query: Prisma.InputJsonValue, ttlMs: number, request: () => Promise<T>): Promise<T | null> {
    const startedAt = Date.now();
    try {
      const result = await request();
      const data = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
      await this.prisma.$transaction([
        this.prisma.tripResource.create({ data: { tripId, kind, provider, query, data, expiresAt: new Date(Date.now() + ttlMs) } }),
        this.prisma.providerCall.create({ data: { provider, operation: `${kind}.get`, status: "SUCCEEDED", durationMs: Date.now() - startedAt, request: query, response: { cached: false } } }),
      ]);
      return result;
    } catch {
      await this.prisma.providerCall.create({ data: { provider, operation: `${kind}.get`, status: "FAILED", durationMs: Date.now() - startedAt, errorCode: "PROVIDER_FAILED", request: query } });
      return null;
    }
  }
}
