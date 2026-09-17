import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ImageTranslationResult } from "@koreamate/contracts";
import { PrismaService } from "../database/prisma.service.js";
import {
  TRANSLATION_PROVIDER,
  TranslationProviderNotConfiguredError,
  type TranslationProvider,
} from "./translation-provider.js";
import { PaddleOcrProvider, PaddleOcrUnavailableError } from "./paddle-ocr.provider.js";

type TranslationJob = {
  jobId: string;
  conversationId: string;
  sourceMessageId: string;
  text: string;
  images?: string[];
};

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRANSLATION_PROVIDER) private readonly provider: TranslationProvider,
    private readonly ocr: PaddleOcrProvider,
  ) {}

  async process(job: TranslationJob): Promise<void> {
    try {
      if (job.images?.length) {
        await this.processImages(job);
        return;
      }
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
      const ocrUnavailable = error instanceof PaddleOcrUnavailableError;
      this.logger.error(`Translation job ${job.jobId} failed: ${error instanceof Error ? error.name : "UnknownError"}`);
      await this.finish(job.jobId, "FAILED", "job.failed", {
        code: notConfigured ? "TRANSLATION_PROVIDER_NOT_CONFIGURED" : ocrUnavailable ? "OCR_SERVICE_UNAVAILABLE" : "TRANSLATION_PROVIDER_FAILED",
        message: notConfigured
          ? "翻译服务还没有配置 API Key。"
          : ocrUnavailable
            ? "图片识别服务刚刚中断，请重新发送这张图片。"
          : "翻译服务暂时不可用，请稍后重试。",
      });
    }
  }

  private async processImages(job: TranslationJob): Promise<void> {
    await this.appendEvent(job.jobId, "translation.image.started", { message: `正在识别 ${job.images?.length ?? 0} 张图片…` });
    const results = [];
    for (const image of job.images ?? []) results.push(await this.ocr.recognize(image));
    const sourceText = results.map((value) => value.text).filter(Boolean).join("\n\n");
    if (!sourceText.trim()) throw new Error("OCR returned no readable text");
    const uncertainText = results.flatMap((value) => value.lines.filter((line) => line.confidence < 0.65).map((line) => line.text));
    await this.appendEvent(job.jobId, "translation.image.ocr.ready", { message: "文字识别完成，正在整理中文…" });
    const interpreted = await this.provider.interpretImageText(sourceText, uncertainText, job.text);
    const result: ImageTranslationResult = { ...interpreted, sourceText, uncertainText, provider: { ocr: "paddleocr", translation: this.provider.name } };
    await this.prisma.message.create({
      data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { imageTranslation: result } },
    });
    await this.appendEvent(job.jobId, "translation.image.ready", { result });
    await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "IMAGE_TRANSLATION_READY" });
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
