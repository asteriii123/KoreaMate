import { Body, Controller, Headers, Post } from "@nestjs/common";
import { PlacesService } from "../place/place.service.js";
import { CrewAiClientService } from "./crewai-client.service.js";
import { OpenMeteoWeatherProvider } from "../plan/weather.js";
import { FlightMcpProvider } from "../plan/flights.js";
import { HotelMcpProvider } from "../plan/hotels.js";

type ToolPayload = { query?: string; provider?: string; [key: string]: unknown };

@Controller("internal/agent-tools")
export class AgentToolController {
  constructor(private readonly places: PlacesService, private readonly crewAi: CrewAiClientService, private readonly weather: OpenMeteoWeatherProvider, private readonly flights: FlightMcpProvider, private readonly hotels: HotelMcpProvider) {}

  @Post("run")
  run(@Body() body: Record<string, unknown>, @Headers("x-agent-service-key") key?: string): Promise<unknown> {
    this.assertInternalKey(key);
    return this.crewAi.run({
      runId: String(body.runId ?? body.run_id ?? ""),
      conversationId: String(body.conversationId ?? body.conversation_id ?? ""),
      jobId: String(body.jobId ?? body.job_id ?? ""),
      userId: typeof body.userId === "string" ? body.userId : null,
      guestId: typeof body.guestId === "string" ? body.guestId : null,
      message: String(body.message ?? ""),
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      recentMessages: Array.isArray(body.recentMessages) ? body.recentMessages as Array<{ role: string; text: string }> : [],
      requirements: body.requirements && typeof body.requirements === "object" ? body.requirements as Record<string, unknown> : null,
      previousPlan: body.previousPlan && typeof body.previousPlan === "object" ? body.previousPlan as Record<string, unknown> : null,
    });
  }

  @Post("search-places")
  async searchPlaces(@Body() body: ToolPayload, @Headers("x-agent-service-key") key?: string): Promise<{ places: unknown[] }> {
    this.assertInternalKey(key);
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) return { places: [] };
    return { places: await this.places.search(query, typeof body.provider === "string" ? body.provider : undefined) };
  }

  @Post("get-weather")
  async getWeather(@Body() body: ToolPayload, @Headers("x-agent-service-key") key?: string): Promise<{ weather: unknown | null }> {
    this.assertInternalKey(key);
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const date = typeof body.date === "string" ? body.date : null;
    if (!city) return { weather: null };
    const place = (await this.places.search(city, "kakao"))[0];
    if (!place) return { weather: null };
    return { weather: await this.weather.forecast({ latitude: place.latitude, longitude: place.longitude, startDate: date, tripDays: 1, today: new Date().toISOString().slice(0, 10) }) };
  }

  @Post("search-flights")
  async searchFlights(@Body() body: ToolPayload, @Headers("x-agent-service-key") key?: string): Promise<{ result: unknown | null }> {
    this.assertInternalKey(key);
    try { return { result: await this.flights.search({ fromCity: String(body.fromCity ?? ""), toCity: String(body.toCity ?? ""), departureDate: String(body.departureDate ?? "") }) }; } catch { return { result: null }; }
  }

  @Post("search-hotels")
  async searchHotels(@Body() body: ToolPayload, @Headers("x-agent-service-key") key?: string): Promise<{ result: unknown | null }> {
    this.assertInternalKey(key);
    try { return { result: await this.hotels.search({ destination: String(body.destination ?? ""), checkIn: String(body.checkIn ?? ""), checkOut: String(body.checkOut ?? ""), guests: Number(body.guests ?? 1), query: typeof body.query === "string" ? body.query : undefined }) }; } catch { return { result: null }; }
  }

  private assertInternalKey(key?: string): void {
    const expected = process.env.AGENT_INTERNAL_SERVICE_KEY;
    if (!expected || key !== expected) throw new Error("Invalid agent service key");
  }
}
