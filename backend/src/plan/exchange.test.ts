import { afterEach, describe, expect, it, vi } from "vitest";
import { FrankfurterExchangeProvider } from "./exchange.js";
import { CitationFactory } from "../citation/citation.factory.js";

describe("FrankfurterExchangeProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes the latest KRW rate", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ date: "2026-09-15", base: "CNY", quote: "KRW", rate: 200.64 }) }));
    await expect(new FrankfurterExchangeProvider(new CitationFactory()).latest("CNY")).resolves.toMatchObject({ base: "CNY", quote: "KRW", rate: 200.64, citation: { provider: "frankfurter" } });
  });
});
