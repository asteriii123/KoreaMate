import { Controller, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import type { TripPlan } from "@koreamate/contracts";
import { TravelService } from "./travel.service.js";

@Controller("trips")
export class TravelController {
  constructor(private readonly travel: TravelService) {}

  @Post(":tripId/versions/:versionId/restore")
  restore(
    @Param("tripId", new ParseUUIDPipe()) tripId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ): Promise<TripPlan> {
    return this.travel.restore(tripId, versionId);
  }
}
