import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenMeteoWeatherProvider } from "./open-meteo-weather.provider.js";
import { CitationFactory } from "../citations/citation.factory.js";

const citations = new CitationFactory();

describe("OpenMeteoWeatherProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not request weather outside the 16-day forecast range", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(new OpenMeteoWeatherProvider(citations).forecast({ latitude: 37.57, longitude: 126.98, startDate: "2026-10-10", tripDays: 2, today: "2026-09-15" }))
      .resolves.toEqual({ status: "pending", reason: "outside_forecast_range" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes daily weather", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ daily: { time: ["2026-09-16"], temperature_2m_min: [14.2], temperature_2m_max: [24.8], precipitation_probability_max: [35], weather_code: [2] } }) }));
    const result = await new OpenMeteoWeatherProvider(citations).forecast({ latitude: 37.57, longitude: 126.98, startDate: "2026-09-16", tripDays: 1, today: "2026-09-15" });
    expect(result).toMatchObject({ status: "available", days: [{ temperatureMin: 14.2, temperatureMax: 24.8, precipitationProbability: 35 }] });
  });
});
