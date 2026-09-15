import { Injectable } from "@nestjs/common";
import { ExchangeRateContextSchema, type ExchangeRateContext } from "@koreamate/contracts";
import { z } from "zod";

const ResponseSchema = z.object({
  date: z.iso.date(),
  base: z.string().length(3),
  quote: z.literal("KRW"),
  rate: z.number().positive(),
});

@Injectable()
export class FrankfurterExchangeProvider {
  async latest(baseCurrency: string): Promise<ExchangeRateContext> {
    const base = baseCurrency.toUpperCase();
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base)}/KRW`, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Frankfurter returned HTTP ${response.status}`);
    return ExchangeRateContextSchema.parse({ ...ResponseSchema.parse(await response.json()), source: "frankfurter", fetchedAt: new Date().toISOString() });
  }
}
