import { Controller, Get, Headers, Param, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { IdentityService } from "../auth/identity.service.js";
import { ImageAssetsService } from "./image.service.js";

@Controller("image-assets")
export class ImageAssetsController {
  constructor(private readonly assets: ImageAssetsService, private readonly identity: IdentityService) {}

  @Get(":id/:variant")
  async get(@Param("id") id: string, @Param("variant") variant: string, @Query("download") download: string | undefined, @Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    if (variant !== "original" && variant !== "translated") throw new UnauthorizedException();
    const result = await this.assets.resolveForOwner(id, variant, await this.identity.resolve(request));
    if (result.signedUrl) { void reply.redirect(result.signedUrl); return; }
    if (download === "1") reply.header("Content-Disposition", `attachment; filename="koreamate-${variant}.${variant === "translated" ? "webp" : "jpg"}"`);
    reply.type(result.mimeType).send(await this.assets.read(result.key));
  }

  @Post("internal/cleanup")
  async cleanup(@Headers("x-internal-key") key?: string): Promise<{ deleted: number }> {
    if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) throw new UnauthorizedException();
    return this.assets.cleanupExpired();
  }
}
