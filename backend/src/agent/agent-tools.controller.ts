import { Body, Controller, Headers, Post } from "@nestjs/common";
import { PlacesService } from "../place/place.service.js";
import { CrewAiBridgeService } from "./crewai-bridge.service.js";
import { OpenMeteoWeatherProvider } from "../plan/weather.js";
import { FlightMcpProvider } from "../plan/flights.js";
import { HotelMcpProvider } from "../plan/hotels.js";
import { SavedPlacesService } from "../saved/saved.service.js";
import { MemoryService } from "../memory/memory.service.js";
import type { Identity } from "../auth/identity.service.js";
import { TravelService } from "../plan/plan.service.js";
import { TranslationService } from "../translate/translate.service.js";

type ToolPayload = { query?: string; provider?: string; [key: string]: unknown };

@Controller("internal/agent-tools")
export class AgentToolsController {
  constructor(private readonly places: PlacesService, private readonly crewAi: CrewAiBridgeService, private readonly weather: OpenMeteoWeatherProvider, private readonly flights: FlightMcpProvider, private readonly hotels: HotelMcpProvider, private readonly saved: SavedPlacesService, private readonly memories: MemoryService, private readonly travel: TravelService, private readonly translation: TranslationService) {}

  @Post("create-trip-plan")
  async createTripPlan(@Body() body: ToolPayload, @Headers("x-agent-service-key") key?: string): Promise<{ accepted: true; jobId: string }> {
    this.assertInternalKey(key);
    const job = this.travelJob(body);
    void this.travel.process(job);
    return { accepted: true, jobId: job.jobId };
  }

  @Post("modify-trip-version")
  async modifyTripVersion(@Body() body: ToolPayload, @Headers("x-agent-service-key") key?: string): Promise<{ accepted: true; jobId: string }> {
    return this.createTripPlan(body, key);
  }

  @Post("translate-text")
  async translateText(@Body() body: ToolPayload, @Headers("x-agent-service-key") key?: string): Promise<{ accepted: true; jobId: string }> {
    this.assertInternalKey(key);
    const jobId = String(body.jobId ?? "");
    void this.translation.process({ jobId, conversationId: String(body.conversationId ?? ""), sourceMessageId: String(body.sourceMessageId ?? ""), text: String(body.text ?? ""), assetIds: [] });
    return { accepted: true, jobId };
  }

  @Post("saved-places")
  async savedPlaces(@Body() body: ToolPayload, @Headers("x-agent-service-key") key?: string): Promise<unknown> {
    this.assertInternalKey(key);
    const identity = this.identity(body);
    const action = String(body.action ?? "list");
    if (action === "list") return this.saved.list(identity);
    if (action === "create" && typeof body.placeId === "string") return this.saved.create(identity, body.placeId, typeof body.note === "string" ? body.note : null);
    if (action === "remove" && typeof body.placeId === "string") return { removed: await this.saved.removePlace(identity, body.placeId) };
    return { error: "INVALID_SAVED_PLACE_ACTION" };
  }

  @Post("memory")
  async memory(@Body() body: ToolPayload, @Headers("x-agent-service-key") key?: string): Promise<unknown> {
    this.assertInternalKey(key);
    const identity = this.identity(body);
    if (body.action === "list") return this.memories.list(identity);
    if (body.action === "remove" && typeof body.memoryId === "string") { await this.memories.remove(identity, body.memoryId); return { removed: true }; }
    if (body.action === "upsert" && Array.isArray(body.candidates)) return { items: await this.memories.upsertCandidates(identity, body.candidates as never[]) };
    return { error: "INVALID_MEMORY_ACTION" };
  }

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

  @Post("resume")
  resume(@Body() body: Record<string, unknown>, @Headers("x-agent-service-key") key?: string): Promise<unknown> {
    this.assertInternalKey(key);
    const originalRunId = String(body.runId ?? body.run_id ?? "");
    const confirmation = String(body.confirmation ?? "已确认执行");
    return this.crewAi.run({
      runId: crypto.randomUUID(),
      conversationId: String(body.conversationId ?? body.conversation_id ?? ""),
      jobId: String(body.jobId ?? body.job_id ?? ""),
      userId: typeof body.userId === "string" ? body.userId : null,
      guestId: typeof body.guestId === "string" ? body.guestId : null,
      message: `用户确认执行原任务 ${originalRunId}：${confirmation}`,
      attachments: [],
      recentMessages: [],
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

  private identity(body: ToolPayload): Identity { return { userId: typeof body.userId === "string" ? body.userId : null, guestId: typeof body.guestId === "string" ? body.guestId : null }; }
  private travelJob(body: ToolPayload): { jobId: string; conversationId: string; sourceMessageId: string; text: string; images?: string[] } { return { jobId: String(body.jobId ?? ""), conversationId: String(body.conversationId ?? ""), sourceMessageId: String(body.sourceMessageId ?? ""), text: String(body.text ?? ""), images: Array.isArray(body.images) ? body.images as string[] : [] }; }
}
