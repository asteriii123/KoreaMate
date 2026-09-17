import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ImageTranslationResult } from "@koreamate/contracts";
import { PrismaService } from "../database/prisma.service.js";
import {
  TRANSLATION_PROVIDER,
  TranslationProviderNotConfiguredError,
  type TranslationProvider,
} from "./translate-provider.js";
import { PaddleOcrProvider, PaddleOcrUnavailableError } from "./ocr.js";
import { ImageAssetsService } from "../image/image.service.js";
import { ImageRendererService, type RenderRegion } from "./render.js";

type TranslationJob = {
  jobId: string;
  conversationId: string;
  sourceMessageId: string;
  text: string;
  assetIds?: string[];
};

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRANSLATION_PROVIDER) private readonly provider: TranslationProvider,
    private readonly ocr: PaddleOcrProvider,
    private readonly imageAssets: ImageAssetsService,
    private readonly renderer: ImageRendererService,
  ) {}

  async process(job: TranslationJob): Promise<void> {
    try {
      if (job.assetIds?.length) {
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
            ? "图片识别服务暂时不可用，请稍后重试。"
          : "翻译服务暂时不可用，请稍后重试。",
      });
    }
  }

  private async processImages(job: TranslationJob): Promise<void> {
    await this.appendEvent(job.jobId, "translation.image.started", { message: `正在识别 ${job.assetIds?.length ?? 0} 张图片…` });
    const partials: ImageTranslationResult[] = [];
    const assets: ImageTranslationResult["assets"] = [];
    const regions: ImageTranslationResult["regions"] = [];
    for (const assetId of job.assetIds ?? []) {
      const outcome = await this.processAsset(assetId, job).catch(() => null);
      if (outcome) {
        partials.push(outcome.interpreted);
        regions.push(...outcome.regions);
      }
      assets.push(await this.imageAssets.descriptor(assetId));
    }
    if (!partials.length) throw new PaddleOcrUnavailableError();
    await this.appendEvent(job.jobId, "translation.image.ocr.ready", { message: "文字识别完成，正在生成中文译图…" });
    const sourceText = partials.map((part) => part.sourceText).filter(Boolean).join("\n\n");
    const uncertainText = partials.flatMap((part) => part.uncertainText);
    const first = partials[0]!;
    const result: ImageTranslationResult = {
      ...first,
      sourceText,
      uncertainText,
      sections: partials.flatMap((part) => part.sections),
      menuItems: partials.flatMap((part) => part.menuItems),
      assets,
      regions,
      provider: { ocr: "paddleocr", translation: this.provider.name },
    };
    await this.prisma.message.create({
      data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { imageTranslation: result } },
    });
    await this.appendEvent(job.jobId, "translation.image.ready", { result });
    await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "IMAGE_TRANSLATION_READY" });
  }

  private async processAsset(assetId: string, job: TranslationJob): Promise<{ interpreted: ImageTranslationResult; regions: ImageTranslationResult["regions"] }> {
    const source = await this.imageAssets.source(assetId);
    const mime = await this.mimeFor(source.buffer);
    let ocr: Awaited<ReturnType<PaddleOcrProvider["recognize"]>>;
    try {
      ocr = await this.ocr.recognize(`data:${mime};base64,${source.buffer.toString("base64")}`);
    } catch (error) {
      await this.imageAssets.fail(assetId, error instanceof PaddleOcrUnavailableError ? "OCR_SERVICE_UNAVAILABLE" : "OCR_FAILED");
      throw error;
    }
    if (!ocr.text.trim()) {
      await this.imageAssets.fail(assetId, "OCR_EMPTY");
      throw new Error("OCR_EMPTY");
    }
    const uncertain = ocr.lines.filter((line) => line.confidence < 0.65).map((line) => line.text);
    let interpreted: ImageTranslationResult;
    try {
      interpreted = await this.provider.interpretImageText(ocr.text, uncertain, job.text);
    } catch (error) {
      await this.imageAssets.fail(assetId, "TRANSLATION_FAILED");
      throw error;
    }
    const sx = source.asset.width / Math.max(1, ocr.width);
    const sy = source.asset.height / Math.max(1, ocr.height);
    const renderRegions: RenderRegion[] = ocr.lines.map((line, index) => ({
      ...line,
      polygon: line.polygon.map(([x, y]) => [x * sx, y * sy]) as RenderRegion["polygon"],
      translation: interpreted.sections[index]?.translation?.trim() || line.text,
    }));
    const publicRegions = renderRegions.map((line) => ({ assetId, lineId: line.lineId, source: line.text, translation: line.translation, confidence: line.confidence, polygon: line.polygon }));
    try {
      await this.imageAssets.complete(assetId, await this.renderer.render(source.buffer, renderRegions), publicRegions);
    } catch {
      await this.imageAssets.textOnly(assetId, publicRegions, "IMAGE_RENDER_FAILED");
    }
    return { interpreted, regions: publicRegions };
  }

  private async mimeFor(buffer: Buffer): Promise<string> {
    const format = (await import("sharp")).default(buffer).metadata().then((value) => value.format);
    const value = await format;
    return value === "png" ? "image/png" : value === "webp" ? "image/webp" : "image/jpeg";
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
