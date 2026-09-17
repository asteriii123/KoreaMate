import { Module } from "@nestjs/common";
import { OpenAiCompatibleTranslationProvider } from "./openai-compatible-translation.provider.js";
import { TranslationService } from "./translation.service.js";
import { TRANSLATION_PROVIDER } from "./translation-provider.js";
import { PaddleOcrProvider } from "./paddle-ocr.provider.js";
import { ImageAssetsModule } from "../image-assets/image-assets.module.js";
import { ImageRendererService } from "./image-renderer.service.js";

@Module({
  imports: [ImageAssetsModule],
  providers: [
    TranslationService,
    OpenAiCompatibleTranslationProvider,
    PaddleOcrProvider,
    ImageRendererService,
    { provide: TRANSLATION_PROVIDER, useExisting: OpenAiCompatibleTranslationProvider },
  ],
  exports: [TranslationService],
})
export class TranslationModule {}
