import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { TravelService } from "../plan/plan.service.js";
import { TranslationService } from "../translate/translate.service.js";
import { CrewAiBridgeService } from "./crewai-bridge.service.js";
import { StreamingLlmService } from "./streaming-llm.service.js";
import { CONVERSATION_INTENT_PROVIDER, type ConversationContext, type ConversationIntentProvider } from "./intent-provider.js";

type Job = { jobId: string; conversationId: string; sourceMessageId: string; text: string; images?: string[]; assetIds?: string[] };

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private readonly prisma: PrismaService, @Inject(CONVERSATION_INTENT_PROVIDER) private readonly intents: ConversationIntentProvider, private readonly travel: TravelService, private readonly translation: TranslationService, private readonly crewAi: CrewAiBridgeService, private readonly llm: StreamingLlmService) {}

  async process(job: Job): Promise<void> {
    try {
      const conversation = await this.prisma.conversation.findUnique({ where: { id: job.conversationId }, select: { mode: true, userId: true, guestId: true } });
      if (conversation?.mode === "UNIFIED") {
        await this.processWithCrewAi(job, conversation);
        return;
      }
      await this.event(job.jobId, "conversation.started", { message: "正在开始理解你的话…" });
      await this.event(job.jobId, "conversation.understanding", { message: "正在理解你的需求…" });
      await this.rememberExplicitRequirements(job.conversationId, job.text);
      const context = await this.context(job.conversationId, job.text);
      const decision = await this.intents.decide(context);
      await this.event(job.jobId, "conversation.routing", { kind: decision.kind, action: decision.action });
      if (decision.action === "create_plan" || decision.action === "modify_plan") {
        await this.event(job.jobId, "conversation.executing", { message: decision.action === "modify_plan" ? "正在按你的要求修改行程…" : "正在生成行程…" });
        await this.travel.process(job);
        return;
      }
      if (decision.kind === "translation") {
        await this.event(job.jobId, "conversation.executing", { message: "正在准备翻译…" });
        await this.translation.process(job);
        return;
      }
      const reply = decision.reply ?? "我可以帮你推荐地点、回答旅行问题，或者在你明确提出后生成行程。";
      await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text: reply } as Prisma.InputJsonValue } });
      await this.event(job.jobId, "conversation.result.ready", { reply });
      await this.event(job.jobId, "travel.answer", { answer: reply });
      await this.finish(job.jobId);
    } catch (error) {
      this.logger.error(`Conversation job ${job.jobId} failed`, error instanceof Error ? error.stack : String(error));
      await this.fail(job.jobId);
    }
  }

  private async processWithCrewAi(job: Job, identity: { userId: string | null; guestId: string | null }): Promise<void> {
    await this.event(job.jobId, "agent.started", { message: "正在理解你的需求…" });
    await this.event(job.jobId, "agent.thinking", { message: "Agent 正在分析上下文并选择工具…" });
    const context = await this.context(job.conversationId, job.text);
    try {
      const result = await this.crewAi.run({
        runId: job.jobId,
        conversationId: job.conversationId,
        jobId: job.jobId,
        userId: identity.userId,
        guestId: identity.guestId,
        message: job.text,
        attachments: job.images ?? [],
        recentMessages: context.recentMessages,
        requirements: context.requirements as Record<string, unknown> | null,
        previousPlan: context.previousPlan as Record<string, unknown> | null,
      }) as { status?: string; reply?: string; pending_action?: unknown };
      if (result.status === "question" || result.status === "confirmation") {
        const reply = result.reply ?? "还需要你补充一点信息。";
        await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text: reply } as Prisma.InputJsonValue } });
        await this.event(job.jobId, result.status === "question" ? "agent.question" : "agent.confirmation.required", { reply, pendingAction: result.pending_action ?? null });
      } else {
        // CrewAI may answer with a useful text draft before it has produced a
        // contract-shaped TripPlan. For explicit itinerary requests, hand the
        // same job to the domain planner so the UI receives travel.plan.ready
        // and renders the designed itinerary cards instead of raw Markdown.
        if (this.isItineraryRequest(job.text)) {
          await this.event(job.jobId, "conversation.executing", { message: "正在生成行程卡片…" });
          await this.travel.process(job);
          return;
        }
        const fallbackReply = result.reply ?? "已完成处理。";
        const reply = await this.streamFinalReply(job.jobId, fallbackReply);
        await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text: reply } as Prisma.InputJsonValue } });
        await this.event(job.jobId, "agent.result.ready", { reply });
      }
      await this.finish(job.jobId);
    } catch (error) {
      this.logger.error(`CrewAI job ${job.jobId} failed`, error instanceof Error ? error.stack : String(error));
      await this.fail(job.jobId);
    }
  }

  private isItineraryRequest(text: string): boolean {
    return /(规划|安排|行程|路线|怎么玩|几天|第\s*[一二三四五六七八九十0-9]+天|预算|旅行计划)/u.test(text)
      && /(首尔|釜山|济州|济州岛|仁川|大邱|庆州|韩国)/u.test(text);
  }

  private async streamFinalReply(jobId: string, fallbackReply: string): Promise<string> {
    try {
      const stream = this.llm.streamReply({
        system: "你是 KoreaMate 旅行助手。请根据下面的处理结果，用简洁自然的中文向用户输出最终回复。直接输出回复正文，不要加前缀，不要解释，不要复述指令。",
        user: `处理结果：\n${fallbackReply}`,
      });
      let full = "";
      let buffer = "";
      let lastFlush = Date.now();
      for await (const chunk of stream) {
        full += chunk;
        buffer += chunk;
        const now = Date.now();
        if (buffer && (now - lastFlush >= 80 || buffer.length >= 32)) {
          await this.event(jobId, "agent.reply.delta", { delta: buffer });
          buffer = "";
          lastFlush = now;
        }
      }
      if (buffer) await this.event(jobId, "agent.reply.delta", { delta: buffer });
      const reply = full.trim();
      return reply || fallbackReply;
    } catch (error) {
      this.logger.warn(`流式回复失败，回退为整段输出：${error instanceof Error ? error.message : String(error)}`);
      await this.event(jobId, "agent.reply.delta", { delta: fallbackReply });
      return fallbackReply;
    }
  }

  private async rememberExplicitRequirements(conversationId: string, text: string): Promise<void> {
    const destination = /(首尔|釜山|济州岛|济州|仁川|大邱|庆州)/u.exec(text)?.[1] ?? null;
    const date = /(\d{1,2})[./月](\d{1,2})(?:日|号)?/u.exec(text);
    const travelers = /(\d+)\s*(?:个人|人|位)/u.exec(text)?.[1];
    if (!destination && !date && !travelers) return;
    const trip = await this.prisma.trip.upsert({ where: { conversationId }, create: { conversationId }, update: {} });
    const existing = await this.prisma.tripRequirement.findUnique({ where: { tripId: trip.id } });
    const current = existing?.data && typeof existing.data === "object" && !Array.isArray(existing.data) ? existing.data as Record<string, unknown> : {};
    const year = new Date().getFullYear();
    const startDate = date ? `${year}-${date[1].padStart(2, "0")}-${date[2].padStart(2, "0")}` : undefined;
    await this.prisma.tripRequirement.upsert({
      where: { tripId: trip.id },
      create: { tripId: trip.id, data: { ...current, destination: destination === "济州" ? "济州岛" : destination, startDate, travelers: travelers ? Number(travelers) : undefined } },
      update: { data: { ...current, ...(destination ? { destination: destination === "济州" ? "济州岛" : destination } : {}), ...(startDate ? { startDate } : {}), ...(travelers ? { travelers: Number(travelers) } : {}) } },
    });
  }

  private async context(conversationId: string, message: string): Promise<ConversationContext> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, include: { messages: { orderBy: { createdAt: "desc" }, take: 12 }, trip: { include: { requirement: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } } } } });
    const recentMessages = (conversation?.messages ?? []).reverse().map((item) => ({ role: item.role, text: this.text(item.content) }));
    return { message, recentMessages, requirements: conversation?.trip?.requirement?.data ?? null, pendingField: conversation?.trip?.requirement?.pendingField ? String(conversation.trip.requirement.pendingField) : null, previousPlan: conversation?.trip?.versions[0] ?? null };
  }

  private text(value: Prisma.JsonValue): string { return value && typeof value === "object" && !Array.isArray(value) && "text" in value && typeof value.text === "string" ? value.text : ""; }
  private async event(jobId: string, type: string, data: Record<string, unknown>): Promise<void> { const last = await this.prisma.jobEvent.findFirst({ where: { jobId }, orderBy: { sequence: "desc" } }); await this.prisma.jobEvent.create({ data: { jobId, sequence: (last?.sequence ?? 0) + 1, type, data: data as Prisma.InputJsonValue } }); }
  private async finish(jobId: string): Promise<void> { await this.prisma.job.update({ where: { id: jobId }, data: { status: "COMPLETED" } }); await this.event(jobId, "job.completed", { stage: "CONVERSATION_READY" }); }
  private async fail(jobId: string): Promise<void> {
    try {
      await this.event(jobId, "conversation.failed", { message: "暂时没能处理这条消息，请稍后重试。" });
      await this.event(jobId, "job.failed", { code: "CONVERSATION_FAILED", message: "暂时没能处理这条消息，请稍后重试。" });
      await this.prisma.job.update({ where: { id: jobId }, data: { status: "FAILED" } });
    } catch (error) {
      this.logger.error(`Conversation job ${jobId} could not be marked failed`, error instanceof Error ? error.stack : String(error));
    }
  }
}
