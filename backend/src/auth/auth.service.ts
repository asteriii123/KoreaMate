import { BadRequestException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { IdentityService } from "./identity.service.js";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly identity: IdentityService) {}

  async requestCode(emailInput: string): Promise<void> {
    const email = emailInput.trim().toLowerCase();
    const recent = await this.prisma.emailVerificationCode.count({ where: { email, createdAt: { gt: new Date(Date.now() - 60_000) } } });
    if (recent > 0) throw new HttpException("请一分钟后再试", HttpStatus.TOO_MANY_REQUESTS);
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.prisma.emailVerificationCode.create({ data: { email, codeHash: this.identity.hash(`${email}:${code}`), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    await this.send(email, code);
  }

  async verify(emailInput: string, code: string): Promise<{ id: string; email: string }> {
    const email = emailInput.trim().toLowerCase();
    const record = await this.prisma.emailVerificationCode.findFirst({ where: { email, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (!record || record.attempts >= 5 || record.codeHash !== this.identity.hash(`${email}:${code}`)) {
      if (record) await this.prisma.emailVerificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException("验证码错误或已过期");
    }
    const [, user] = await this.prisma.$transaction([
      this.prisma.emailVerificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.upsert({ where: { email }, create: { email }, update: {} }),
    ]);
    return { id: user.id, email: user.email };
  }

  private async send(email: string, code: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is required in production");
      console.info(`[KoreaMate] ${email} 的登录验证码：${code}`);
      return;
    }
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL ?? "KoreaMate <onboarding@resend.dev>", to: [email], subject: "KoreaMate 登录验证码", html: `<p>你的验证码是 <strong>${code}</strong>，10 分钟内有效。</p>` }) });
    if (!response.ok) throw new Error(`Resend failed with ${response.status}`);
  }
}
