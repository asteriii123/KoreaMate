import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { CreateSavedPlaceRequestSchema, UpdateSavedPlaceRequestSchema, type SavedPlace } from "@koreamate/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { IdentityService } from "../auth/identity.service.js";
import { SavedPlacesService } from "./saved-places.service.js";

@Controller("saved-places")
export class SavedPlacesController {
  constructor(private readonly savedPlaces: SavedPlacesService, private readonly identity: IdentityService) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<{ items: SavedPlace[] }> {
    return this.savedPlaces.list(await this.identity.resolve(request, reply));
  }

  @Post()
  async create(@Body() body: unknown, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<SavedPlace> {
    const input = this.parse(CreateSavedPlaceRequestSchema, body);
    return this.savedPlaces.create(await this.identity.resolve(request, reply), input.placeId, input.note);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<SavedPlace> {
    const input = this.parse(UpdateSavedPlaceRequestSchema, body);
    return this.savedPlaces.update(await this.identity.resolve(request, reply), id, input.note);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<{ ok: true }> {
    await this.savedPlaces.remove(await this.identity.resolve(request, reply), id);
    return { ok: true };
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("请输入有效信息");
    return parsed.data;
  }
}
