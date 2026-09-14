import { Module } from "@nestjs/common";
import { OpenAiCompatibleTranslationProvider } from "./openai-compatible-translation.provider.js";
import { TranslationService } from "./translation.service.js";
import { TRANSLATION_PROVIDER } from "./translation-provider.js";

@Module({
  providers: [
    TranslationService,
    OpenAiCompatibleTranslationProvider,
    { provide: TRANSLATION_PROVIDER, useExisting: OpenAiCompatibleTranslationProvider },
  ],
  exports: [TranslationService],
})
export class TranslationModule {}
