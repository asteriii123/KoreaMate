import { Controller, Delete, Get, Param, Req, Res } from "@nestjs/common";
import type { UserMemory } from "@koreamate/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { IdentityService } from "../auth/identity.service.js";
import { MemoryService } from "./memory.service.js";

@Controller("memories")
export class MemoryController {
  constructor(private readonly memories: MemoryService, private readonly identity: IdentityService) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<{ items: UserMemory[] }> {
    return this.memories.list(await this.identity.resolve(request, reply));
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<{ ok: true }> {
    await this.memories.remove(await this.identity.resolve(request, reply), id);
    return { ok: true };
  }
}
