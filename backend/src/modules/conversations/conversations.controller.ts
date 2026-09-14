import { BadRequestException, Body, Controller, Headers, Param, Post } from "@nestjs/common";
import {
  CreateConversationRequestSchema,
  SendMessageRequestSchema,
  type AcceptedMessage,
  type Conversation,
} from "@koreamate/contracts";
import { z } from "zod";
import { ConversationsService } from "./conversations.service.js";

@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  async create(@Body() input: unknown): Promise<Conversation> {
    const request = this.parse(CreateConversationRequestSchema, input);
    return this.conversations.create(request.mode);
  }

  @Post(":id/messages")
  async sendMessage(
    @Param("id") conversationId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() input: unknown,
  ): Promise<AcceptedMessage> {
    if (!idempotencyKey || !z.string().uuid().safeParse(idempotencyKey).success) {
      throw new BadRequestException("A valid Idempotency-Key header is required");
    }
    const request = this.parse(SendMessageRequestSchema, input);
    return this.conversations.sendMessage(conversationId, idempotencyKey, request);
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(z.prettifyError(result.error));
    }
    return result.data;
  }
}
