import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AcceptedMessage,
  Conversation,
  ConversationMode,
  SendMessageRequest,
} from "@koreamate/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(mode: ConversationMode): Promise<Conversation> {
    const conversation = await this.prisma.conversation.create({ data: { mode } });
    return {
      id: conversation.id,
      mode: conversation.mode,
      createdAt: conversation.createdAt.toISOString(),
    };
  }

  async sendMessage(
    conversationId: string,
    idempotencyKey: string,
    request: SendMessageRequest,
  ): Promise<AcceptedMessage> {
    const existing = await this.prisma.message.findUnique({
      where: { conversationId_idempotencyKey: { conversationId, idempotencyKey } },
      include: { job: true },
    });

    if (existing?.job) {
      return { messageId: existing.id, jobId: existing.job.id, status: "ACCEPTED" };
    }

    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const message = await transaction.message.create({
          data: {
            conversationId,
            role: "USER",
            contentType: "TEXT",
            content: request.content,
            idempotencyKey,
          },
        });
        const job = await transaction.job.create({
          data: { conversationId, messageId: message.id },
        });
        await transaction.jobEvent.createMany({
          data: [
            {
              jobId: job.id,
              sequence: 1,
              type: "message.accepted",
              data: { messageId: message.id },
            },
            {
              jobId: job.id,
              sequence: 2,
              type: "job.completed",
              data: { stage: "MESSAGE_STORED" },
            },
          ],
        });
        await transaction.job.update({ where: { id: job.id }, data: { status: "COMPLETED" } });
        return { message, job };
      });

      return { messageId: result.message.id, jobId: result.job.id, status: "ACCEPTED" };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await this.prisma.message.findUnique({
          where: { conversationId_idempotencyKey: { conversationId, idempotencyKey } },
          include: { job: true },
        });
        if (duplicate?.job) {
          return { messageId: duplicate.id, jobId: duplicate.job.id, status: "ACCEPTED" };
        }
      }
      throw error;
    }
  }
}
