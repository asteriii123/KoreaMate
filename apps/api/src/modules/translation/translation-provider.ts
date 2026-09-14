import { z } from "zod";

export const TRANSLATION_PROVIDER = Symbol("TRANSLATION_PROVIDER");

export const ProviderTranslationSchema = z.object({
  sourceLanguage: z.enum(["zh", "ko"]),
  targetLanguage: z.enum(["zh", "ko"]),
  translatedText: z.string().trim().min(1),
  naturalExpression: z.string().trim().min(1),
  pronunciation: z.string().trim().min(1).nullable(),
  politeness: z.enum(["casual", "polite", "formal"]),
});

export type ProviderTranslation = z.infer<typeof ProviderTranslationSchema>;

export interface TranslationProvider {
  readonly name: string;
  translate(text: string): Promise<ProviderTranslation>;
}

export class TranslationProviderNotConfiguredError extends Error {
  constructor() {
    super("Translation provider is not configured");
  }
}
