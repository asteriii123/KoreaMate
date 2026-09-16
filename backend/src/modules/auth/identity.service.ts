import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaService } from "../database/prisma.service.js";

export type Identity = { userId: string | null; guestId: string | null };

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(request: FastifyRequest, reply?: FastifyReply): Promise<Identity> {
    const cookies = this.cookies(request.headers.cookie);
    const sessionToken = cookies.koreamate_session;
    if (sessionToken) {
      const session = await this.prisma.session.findUnique({ where: { tokenHash: this.hash(sessionToken) } });
      if (session && session.expiresAt > new Date()) return { userId: session.userId, guestId: null };
    }
    const guestToken = cookies.koreamate_guest;
    if (guestToken) {
      const guest = await this.prisma.guestIdentity.findUnique({ where: { tokenHash: this.hash(guestToken) } });
      if (guest && !guest.mergedAt) return { userId: null, guestId: guest.id };
    }
    if (!reply) return { userId: null, guestId: null };
    const token = randomBytes(32).toString("base64url");
    const guest = await this.prisma.guestIdentity.create({ data: { tokenHash: this.hash(token) } });
    this.setCookie(reply, "koreamate_guest", token, 60 * 60 * 24 * 365);
    return { userId: null, guestId: guest.id };
  }

  async createSession(userId: string, guestId: string | null, reply: FastifyReply): Promise<void> {
    if (guestId) {
      await this.prisma.$transaction([
        this.prisma.conversation.updateMany({ where: { guestId }, data: { userId, guestId: null } }),
        this.prisma.guestIdentity.update({ where: { id: guestId }, data: { mergedAt: new Date() } }),
      ]);
    }
    const token = randomBytes(32).toString("base64url");
    await this.prisma.session.create({ data: { userId, tokenHash: this.hash(token), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
    this.setCookie(reply, "koreamate_session", token, 60 * 60 * 24 * 30);
    this.clearCookie(reply, "koreamate_guest");
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = this.cookies(request.headers.cookie).koreamate_session;
    if (token) await this.prisma.session.deleteMany({ where: { tokenHash: this.hash(token) } });
    this.clearCookie(reply, "koreamate_session");
  }

  owns(identity: Identity): { OR: Array<{ userId: string } | { guestId: string }> } {
    const OR: Array<{ userId: string } | { guestId: string }> = [];
    if (identity.userId) OR.push({ userId: identity.userId });
    if (identity.guestId) OR.push({ guestId: identity.guestId });
    return { OR };
  }

  hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }

  private cookies(header?: string): Record<string, string> {
    return Object.fromEntries((header ?? "").split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value).map(([key, value]) => [key, decodeURIComponent(value)]));
  }

  private setCookie(reply: FastifyReply, name: string, value: string, maxAge: number): void {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    this.appendCookie(reply, `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
  }

  private clearCookie(reply: FastifyReply, name: string): void {
    this.appendCookie(reply, `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  private appendCookie(reply: FastifyReply, cookie: string): void {
    const current = reply.raw.getHeader("Set-Cookie");
    const values = current ? (Array.isArray(current) ? current.map(String) : [String(current)]) : [];
    reply.raw.setHeader("Set-Cookie", [...values, cookie]);
  }
}
