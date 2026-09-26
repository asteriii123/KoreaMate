import { Module } from "@nestjs/common";
import { OpenAiCompatibleTranslationProvider } from "./translate-llm.js";
import { TranslationService } from "./translate.service.js";
import { TRANSLATION_PROVIDER } from "./translate-provider.js";
import { PaddleOcrProvider } from "./ocr.js";
import { ImageAssetsModule } from "../image/image.module.js";
import { ImageRendererService } from "./render.js";
import { StreamingLlmService } from "../agent/streaming-llm.service.js";

@Module({
  imports: [ImageAssetsModule],
  providers: [
    TranslationService,
    OpenAiCompatibleTranslationProvider,
    PaddleOcrProvider,
    ImageRendererService,
    StreamingLlmService,
    { provide: TRANSLATION_PROVIDER, useExisting: OpenAiCompatibleTranslationProvider },
  ],
  exports: [TranslationService],
})
export class TranslationModule {}
