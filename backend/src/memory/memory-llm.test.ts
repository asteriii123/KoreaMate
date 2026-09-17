import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleMemoryExtractor } from "./memory-llm.js";

describe("memory extractor", () => {
  const extractor = new OpenAiCompatibleMemoryExtractor();
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("extracts stable preferences without an LLM", async () => {
    vi.stubEnv("LLM_API_KEY", ""); vi.stubEnv("LLM_MODEL", "");
    await expect(extractor.extract("我一般从成都出发，不吃辣，喜欢咖啡店，行程轻松一点")).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "departure_city", value: "成都" }),
      expect.objectContaining({ kind: "constraint", value: "不吃辣" }),
      expect.objectContaining({ kind: "interest", value: "咖啡店" }),
      expect.objectContaining({ kind: "pace", value: "relaxed" }),
    ]));
  });

  it("does not save temporary trip facts or sensitive information", async () => {
    vi.stubEnv("LLM_API_KEY", ""); vi.stubEnv("LLM_MODEL", "");
    await expect(extractor.extract("10月两个人去首尔三天")).resolves.toEqual([]);
    await expect(extractor.extract("我的身份证号是123，诊断为高血压")).resolves.toEqual([]);
  });

  it("falls back to rules when the provider fails", async () => {
    vi.stubEnv("LLM_API_KEY", "key"); vi.stubEnv("LLM_MODEL", "model");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(extractor.extract("我不吃辣")).resolves.toEqual([expect.objectContaining({ kind: "constraint", value: "不吃辣" })]);
  });
});
