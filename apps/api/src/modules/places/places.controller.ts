import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import type { PlaceResult, ProviderStatus } from "@koreamate/contracts";
import { PlacesService } from "./places.service.js";
import { ProviderRegistryService } from "./provider-registry.service.js";

@Controller()
export class PlacesController {
  constructor(private readonly places: PlacesService, private readonly registry: ProviderRegistryService) {}

  @Get("providers")
  statuses(): ProviderStatus[] { return this.registry.statuses(); }

  @Get("places/search")
  search(@Query("query") query?: string, @Query("provider") provider?: string): Promise<PlaceResult[]> {
    const cleanQuery = query?.trim();
    if (!cleanQuery || cleanQuery.length > 100) throw new BadRequestException("query must contain 1 to 100 characters");
    return this.places.search(cleanQuery, provider);
  }
}
