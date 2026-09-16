import { Controller, Get, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import type { TripPlan } from "@koreamate/contracts";
import { TravelService } from "./travel.service.js";
import { IdentityService } from "../auth/identity.service.js";
import type { FastifyRequest } from "fastify";

@Controller("trips")
export class TravelController {
  constructor(private readonly travel: TravelService, private readonly identity: IdentityService) {}

  @Get("confirmed")
  async confirmed(@Req() request: FastifyRequest): Promise<unknown> {
    return this.travel.confirmed(await this.identity.resolve(request));
  }

  @Post(":tripId/versions/:versionId/confirm")
  async confirm(@Param("tripId", new ParseUUIDPipe()) tripId: string, @Param("versionId", new ParseUUIDPipe()) versionId: string, @Req() request: FastifyRequest): Promise<{ ok: true }> {
    return this.travel.confirm(tripId, versionId, await this.identity.resolve(request));
  }

  @Post(":tripId/versions/:versionId/restore")
  restore(
    @Param("tripId", new ParseUUIDPipe()) tripId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Req() request: FastifyRequest,
  ): Promise<TripPlan> {
    return this.identity.resolve(request).then((owner) => this.travel.restore(tripId, versionId, owner));
  }
}
