import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleTranslationProvider } from "./openai-compatible-translation.provider.js";
import { TranslationProviderNotConfiguredError } from "./translation-provider.js";

const originalEnv = {
  apiKey: process.env.LLM_API_KEY,
  model: process.env.LLM_MODEL,
  baseUrl: process.env.LLM_BASE_URL,
};

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.LLM_API_KEY = originalEnv.apiKey;
  process.env.LLM_MODEL = originalEnv.model;
  process.env.LLM_BASE_URL = originalEnv.baseUrl;
});

describe("OpenAiCompatibleTranslationProvider", () => {
  it("fails explicitly when credentials are missing", async () => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;

    await expect(new OpenAiCompatibleTranslationProvider().translate("你好")).rejects
      .toBeInstanceOf(TranslationProviderNotConfiguredError);
  });

  it("maps and validates a JSON translation response", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL = "test-model";
    process.env.LLM_BASE_URL = "https://example.test/v1";
    const fetchMock = vi.fn(async (
      _input: string | URL | Request,
      _init?: RequestInit,
    ): Promise<Response> => {
      void _input;
      void _init;
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              sourceLanguage: "zh",
              targetLanguage: "ko",
              translatedText: "안녕하세요",
              naturalExpression: "안녕하세요",
              pronunciation: "安宁哈塞哟",
              politeness: "polite",
            }),
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new OpenAiCompatibleTranslationProvider().translate("你好");

    expect(result.translatedText).toBe("안녕하세요");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.test/v1/chat/completions");
  });
});
