import { Injectable } from "@nestjs/common";
import { WeatherContextSchema, type WeatherContext } from "@koreamate/contracts";
import { z } from "zod";
import { CitationFactory } from "../citations/citation.factory.js";

const ResponseSchema = z.object({
  daily: z.object({
    time: z.array(z.iso.date()),
    temperature_2m_min: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    precipitation_probability_max: z.array(z.number()),
    weather_code: z.array(z.number().int()),
  }),
});

@Injectable()
export class OpenMeteoWeatherProvider {
  constructor(private readonly citations: CitationFactory) {}

  async forecast(input: { latitude: number; longitude: number; startDate: string | null; tripDays: number; today: string }): Promise<WeatherContext> {
    if (!input.startDate) return { status: "pending", reason: "date_required" };
    const startOffset = this.daysBetween(input.today, input.startDate);
    if (startOffset < 0 || startOffset > 15) return { status: "pending", reason: "outside_forecast_range" };
    const availableDays = Math.min(input.tripDays, 16 - startOffset);
    const endDate = this.addDays(input.startDate, availableDays - 1);
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(input.latitude));
    url.searchParams.set("longitude", String(input.longitude));
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    url.searchParams.set("timezone", "Asia/Seoul");
    url.searchParams.set("start_date", input.startDate);
    url.searchParams.set("end_date", endDate);
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
    const payload = ResponseSchema.parse(await response.json());
    const fetchedAt = new Date();
    return WeatherContextSchema.parse({
      status: "available",
      source: "open-meteo",
      fetchedAt: fetchedAt.toISOString(),
      citation: this.citations.external({
        provider: "open-meteo",
        sourceUrl: "https://open-meteo.com/",
        fetchedAt,
        expiresAt: new Date(fetchedAt.getTime() + 60 * 60 * 1_000),
      }),
      days: payload.daily.time.map((date, index) => ({
        date,
        temperatureMin: payload.daily.temperature_2m_min[index],
        temperatureMax: payload.daily.temperature_2m_max[index],
        precipitationProbability: payload.daily.precipitation_probability_max[index],
        weatherCode: payload.daily.weather_code[index],
      })),
    });
  }

  private daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  }

  private addDays(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  }
}
