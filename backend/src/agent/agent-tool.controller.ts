import { Body, Controller, Headers, Post } from "@nestjs/common";
import { PlacesService } from "../place/place.service.js";

type ToolPayload = { query?: string; provider?: string; [key: string]: unknown };

@Controller("internal/agent-tools")
export class AgentToolController {
  constructor(private readonly places: PlacesService) {}

  @Post("search-places")
  async searchPlaces(@Body() body: ToolPayload, @Headers("x-agent-service-key") key?: string): Promise<{ places: unknown[] }> {
    this.assertInternalKey(key);
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) return { places: [] };
    return { places: await this.places.search(query, typeof body.provider === "string" ? body.provider : undefined) };
  }

  @Post("get-weather")
  getWeather(@Headers("x-agent-service-key") key?: string): never {
    this.assertInternalKey(key);
    throw new Error("Weather tool adapter is not wired yet");
  }

  @Post("search-flights")
  searchFlights(@Headers("x-agent-service-key") key?: string): never {
    this.assertInternalKey(key);
    throw new Error("Flight tool adapter is not wired yet");
  }

  @Post("search-hotels")
  searchHotels(@Headers("x-agent-service-key") key?: string): never {
    this.assertInternalKey(key);
    throw new Error("Hotel tool adapter is not wired yet");
  }

  private assertInternalKey(key?: string): void {
    const expected = process.env.AGENT_INTERNAL_SERVICE_KEY;
    if (!expected || key !== expected) throw new Error("Invalid agent service key");
  }
}
