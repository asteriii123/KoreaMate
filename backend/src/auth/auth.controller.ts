import { BadRequestException, Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { RequestEmailCodeSchema, UserSchema, VerifyEmailCodeSchema } from "@koreamate/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service.js";
import { IdentityService } from "./identity.service.js";
import { PrismaService } from "../database/prisma.service.js";
import type { z } from "zod";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly identity: IdentityService, private readonly prisma: PrismaService) {}

  @Post("email/code")
  async requestCode(@Body() body: unknown): Promise<{ sent: true }> {
    const { email } = this.parse(RequestEmailCodeSchema, body);
    await this.auth.requestCode(email);
    return { sent: true };
  }

  @Post("email/verify")
  async verify(@Body() body: unknown, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<{ id: string; email: string }> {
    const { email, code } = this.parse(VerifyEmailCodeSchema, body);
    const guest = await this.identity.resolve(request, reply);
    const user = UserSchema.parse(await this.auth.verify(email, code));
    await this.identity.createSession(user.id, guest.guestId, reply);
    return user;
  }

  @Get("me")
  async me(@Req() request: FastifyRequest): Promise<{ id: string; email: string } | null> {
    const current = await this.identity.resolve(request);
    if (!current.userId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: current.userId }, select: { id: true, email: true } });
    return user ? UserSchema.parse(user) : null;
  }

  @Post("logout")
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<{ ok: true }> {
    await this.identity.logout(request, reply);
    return { ok: true };
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("请输入有效信息");
    return parsed.data;
  }
}
