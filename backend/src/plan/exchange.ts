import { Injectable } from "@nestjs/common";
import { ExchangeRateContextSchema, type ExchangeRateContext } from "@koreamate/contracts";
import { z } from "zod";
import { CitationFactory } from "../citation/citation.factory.js";

const ResponseSchema = z.object({
  date: z.iso.date(),
  base: z.string().length(3),
  quote: z.literal("KRW"),
  rate: z.number().positive(),
});

@Injectable()
export class FrankfurterExchangeProvider {
  constructor(private readonly citations: CitationFactory) {}

  async latest(baseCurrency: string): Promise<ExchangeRateContext> {
    const base = baseCurrency.toUpperCase();
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base)}/KRW`, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Frankfurter returned HTTP ${response.status}`);
    const fetchedAt = new Date();
    return ExchangeRateContextSchema.parse({
      ...ResponseSchema.parse(await response.json()),
      source: "frankfurter",
      fetchedAt: fetchedAt.toISOString(),
      citation: this.citations.external({
        provider: "frankfurter",
        sourceUrl: "https://frankfurter.app/",
        fetchedAt,
        expiresAt: new Date(fetchedAt.getTime() + 24 * 60 * 60 * 1_000),
      }),
    });
  }
}
