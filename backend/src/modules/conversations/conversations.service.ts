import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AcceptedMessage,
  Conversation,
  ConversationMode,
  SendMessageRequest,
} from "@koreamate/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { TranslationService } from "../translation/translation.service.js";
import { TravelService } from "../travel/travel.service.js";
import type { Identity } from "../auth/identity.service.js";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: TranslationService,
    private readonly travel: TravelService,
  ) {}

  async create(mode: ConversationMode, identity: Identity = { userId: null, guestId: null }): Promise<Conversation> {
    const conversation = await this.prisma.conversation.create({ data: { mode, userId: identity.userId, guestId: identity.guestId } });
    return {
      id: conversation.id,
      mode: conversation.mode,
      createdAt: conversation.createdAt.toISOString(),
    };
  }

  async list(identity: Identity): Promise<{ items: Array<{ conversationId: string; mode: ConversationMode; title: string; updatedAt: string; tripId: string | null; confirmed: boolean }> }> {
    if (!identity.userId && !identity.guestId) return { items: [] };
    const conversations = await this.prisma.conversation.findMany({
      where: this.ownerWhere(identity), orderBy: { updatedAt: "desc" }, take: 100,
      include: { trip: { include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } } }, messages: { where: { role: "USER" }, orderBy: { createdAt: "asc" }, take: 1 } },
    });
    return { items: conversations.map((conversation) => ({ conversationId: conversation.id, mode: conversation.mode, title: conversation.trip?.title ?? this.messageTitle(conversation.messages[0]?.content) ?? (conversation.mode === "TRAVEL" ? "新的旅行" : "新的翻译"), updatedAt: conversation.updatedAt.toISOString(), tripId: conversation.trip?.id ?? null, confirmed: Boolean(conversation.trip?.confirmedAt) })) };
  }

  async get(id: string, identity: Identity): Promise<{ id: string; mode: ConversationMode; createdAt: string; timeline: unknown[]; latestPlan: import("@koreamate/contracts").TripPlan | null }> {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, ...this.ownerWhere(identity) }, include: { messages: { orderBy: { createdAt: "asc" }, include: { translation: true } } } });
    if (!conversation) throw new NotFoundException("Conversation not found");
    const timeline = conversation.messages.flatMap((message) => {
      const text = this.messageText(message.content);
      const imageCount = this.messageImageCount(message.content);
      const items: unknown[] = text || imageCount ? [{ id: message.id, kind: message.role === "USER" ? "user" : "question", text: text || `已上传 ${imageCount} 张照片` }] : [];
      if (message.translation) items.push({ id: message.translation.id, kind: "translation", value: { id: message.translation.id, sourceLanguage: message.translation.sourceLanguage, targetLanguage: message.translation.targetLanguage, sourceText: message.translation.sourceText, translatedText: message.translation.translatedText, naturalExpression: message.translation.naturalExpression, pronunciation: message.translation.pronunciation, politeness: message.translation.politeness } });
      const imageTranslation = this.messageImageTranslation(message.content);
      if (imageTranslation) items.push({ id: message.id, kind: "imageTranslation", value: imageTranslation });
      return items;
    });
    return { id: conversation.id, mode: conversation.mode, createdAt: conversation.createdAt.toISOString(), timeline, latestPlan: await this.travel.latestForConversation(id) };
  }

  async sendMessage(
    conversationId: string,
    idempotencyKey: string,
    request: SendMessageRequest,
    identity: Identity = { userId: null, guestId: null },
  ): Promise<AcceptedMessage> {
    const existing = await this.prisma.message.findUnique({
      where: { conversationId_idempotencyKey: { conversationId, idempotencyKey } },
      include: { job: true },
    });

    if (existing?.job) {
      return { messageId: existing.id, jobId: existing.job.id, status: "ACCEPTED" };
    }

    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, ...this.ownerWhere(identity) } });
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
            content: request.content.type === "IMAGE_TRANSLATION"
              ? { type: request.content.type, text: request.content.text, imageCount: request.content.images.length }
              : request.content,
            idempotencyKey,
          },
        });
        const job = await transaction.job.create({
          data: { conversationId, messageId: message.id },
        });
        await transaction.jobEvent.create({
          data: {
            jobId: job.id,
            sequence: 1,
            type: "message.accepted",
            data: { messageId: message.id },
          },
        });
        return { message, job };
      });

      if (conversation.mode === "TRANSLATION") {
        void this.translation.process({
          jobId: result.job.id,
          conversationId,
          sourceMessageId: result.message.id,
          text: request.content.text,
          images: request.content.type === "IMAGE_TRANSLATION" ? request.content.images : [],
        });
      } else {
        void this.travel.process({
          jobId: result.job.id,
          conversationId,
          sourceMessageId: result.message.id,
          text: request.content.text,
          images: request.content.type === "IMPORT" ? request.content.images : [],
        });
      }

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

  private ownerWhere(identity: Identity): Prisma.ConversationWhereInput {
    if (identity.userId) return { userId: identity.userId };
    if (identity.guestId) return { guestId: identity.guestId };
    return { id: "00000000-0000-0000-0000-000000000000" };
  }

  private messageTitle(content: Prisma.JsonValue | undefined): string | null {
    if (!content || typeof content !== "object" || Array.isArray(content)) return null;
    const text = "text" in content && typeof content.text === "string" ? content.text.trim() : "";
    return text ? `${text.slice(0, 28)}${text.length > 28 ? "…" : ""}` : null;
  }

  private messageText(content: Prisma.JsonValue | undefined): string | null {
    if (!content || typeof content !== "object" || Array.isArray(content)) return null;
    return "text" in content && typeof content.text === "string" ? content.text : null;
  }

  private messageImageCount(content: Prisma.JsonValue | undefined): number {
    if (!content || typeof content !== "object" || Array.isArray(content)) return 0;
    if ("imageCount" in content && typeof content.imageCount === "number") return content.imageCount;
    return "images" in content && Array.isArray(content.images) ? content.images.length : 0;
  }

  private messageImageTranslation(content: Prisma.JsonValue | undefined): Prisma.JsonValue | null {
    if (!content || typeof content !== "object" || Array.isArray(content) || !("imageTranslation" in content)) return null;
    return content.imageTranslation ?? null;
  }
}
