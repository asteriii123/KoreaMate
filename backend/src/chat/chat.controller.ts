import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Req, Res } from "@nestjs/common";
import {
  CreateConversationRequestSchema,
  SendMessageRequestSchema,
  type AcceptedMessage,
  type Conversation,
} from "@koreamate/contracts";
import { z } from "zod";
import { ConversationsService } from "./chat.service.js";
import { IdentityService } from "../auth/identity.service.js";
import type { FastifyReply, FastifyRequest } from "fastify";

@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService, private readonly identity: IdentityService) {}

  @Post()
  async create(@Body() input: unknown, @Req() raw: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<Conversation> {
    const request = this.parse(CreateConversationRequestSchema, input);
    return this.conversations.create(request.mode, await this.identity.resolve(raw, reply));
  }

  @Get()
  async list(@Req() raw: FastifyRequest): Promise<unknown> {
    return this.conversations.list(await this.identity.resolve(raw));
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() raw: FastifyRequest): Promise<unknown> {
    return this.conversations.get(id, await this.identity.resolve(raw));
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Req() raw: FastifyRequest): Promise<{ deleted: true }> {
    await this.conversations.delete(id, await this.identity.resolve(raw));
    return { deleted: true };
  }

  @Post(":id/messages")
  async sendMessage(
    @Param("id") conversationId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() input: unknown,
    @Req() raw: FastifyRequest,
  ): Promise<AcceptedMessage> {
    if (!idempotencyKey || !z.string().uuid().safeParse(idempotencyKey).success) {
      throw new BadRequestException("A valid Idempotency-Key header is required");
    }
    const request = this.parse(SendMessageRequestSchema, input);
    return this.conversations.sendMessage(conversationId, idempotencyKey, request, await this.identity.resolve(raw));
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(z.prettifyError(result.error));
    }
    return result.data;
  }
}
