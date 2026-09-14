import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import {
  TRANSLATION_PROVIDER,
  TranslationProviderNotConfiguredError,
  type TranslationProvider,
} from "./translation-provider.js";

type TranslationJob = {
  jobId: string;
  conversationId: string;
  sourceMessageId: string;
  text: string;
};

@Injectable()
export class TranslationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRANSLATION_PROVIDER) private readonly provider: TranslationProvider,
  ) {}

  async process(job: TranslationJob): Promise<void> {
    try {
      await this.appendEvent(job.jobId, "translation.started", { message: "正在理解这句话…" });
      const result = await this.provider.translate(job.text);
      const translation = await this.prisma.$transaction(async (transaction) => {
        const record = await transaction.translation.create({
          data: {
            conversationId: job.conversationId,
            sourceMessageId: job.sourceMessageId,
            sourceText: job.text,
            provider: this.provider.name,
            ...result,
          },
        });
        await transaction.message.create({
          data: {
            conversationId: job.conversationId,
            role: "ASSISTANT",
            contentType: "TEXT",
            content: { translationId: record.id, translatedText: record.translatedText },
          },
        });
        return record;
      });
      await this.appendEvent(job.jobId, "translation.ready", {
        translation: {
          id: translation.id,
          sourceLanguage: translation.sourceLanguage,
          targetLanguage: translation.targetLanguage,
          sourceText: translation.sourceText,
          translatedText: translation.translatedText,
          naturalExpression: translation.naturalExpression,
          pronunciation: translation.pronunciation,
          politeness: translation.politeness,
        },
      });
      await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRANSLATION_READY" });
    } catch (error) {
      const notConfigured = error instanceof TranslationProviderNotConfiguredError;
      await this.finish(job.jobId, "FAILED", "job.failed", {
        code: notConfigured ? "TRANSLATION_PROVIDER_NOT_CONFIGURED" : "TRANSLATION_PROVIDER_FAILED",
        message: notConfigured
          ? "翻译服务还没有配置 API Key。"
          : "翻译服务暂时不可用，请稍后重试。",
      });
    }
  }

  private async appendEvent(jobId: string, type: string, data: Prisma.InputJsonValue): Promise<void> {
    const aggregate = await this.prisma.jobEvent.aggregate({ where: { jobId }, _max: { sequence: true } });
    await this.prisma.jobEvent.create({
      data: { jobId, sequence: (aggregate._max.sequence ?? 0) + 1, type, data },
    });
  }

  private async finish(
    jobId: string,
    status: "COMPLETED" | "FAILED",
    type: string,
    data: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.appendEvent(jobId, type, data);
    await this.prisma.job.update({ where: { id: jobId }, data: { status } });
  }
}
