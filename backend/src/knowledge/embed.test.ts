import { afterEach, describe, expect, it, vi } from "vitest";
import { EmbeddingClient, EmbeddingClientError } from "./embed.js";

const originalEnv = { ...process.env };

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

describe("EmbeddingClient", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("stays disabled without a service URL and makes no request", async () => {
    delete process.env.EMBEDDING_SERVICE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new EmbeddingClient();
    await expect(client.health()).resolves.toMatchObject({ status: "disabled", reason: "NOT_CONFIGURED" });
    await expect(client.embed(["서울"])).rejects.toMatchObject({ code: "EMBEDDING_DISABLED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts matching health and normalized vectors", async () => {
    process.env.EMBEDDING_SERVICE_URL = "http://127.0.0.1:58030";
    const vector = [1, ...Array(1023).fill(0)] as number[];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: "ok", model: "BAAI/bge-m3", modelVersion: "master", dimensions: 1024, loaded: true }))
      .mockResolvedValueOnce(response({ model: "BAAI/bge-m3", modelVersion: "master", dimensions: 1024, vectors: [vector] }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new EmbeddingClient();
    await expect(client.health()).resolves.toMatchObject({ status: "available", loaded: true });
    await expect(client.embed(["서울"])).resolves.toEqual([vector]);
  });

  it("rejects a mismatched model and malformed vectors", async () => {
    process.env.EMBEDDING_SERVICE_URL = "http://127.0.0.1:58030";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ status: "ok", model: "other", modelVersion: "master", dimensions: 1024, loaded: false }))
      .mockResolvedValueOnce(response({ model: "BAAI/bge-m3", modelVersion: "master", dimensions: 1024, vectors: [[1]] }))
      .mockResolvedValueOnce(response({ model: "BAAI/bge-m3", modelVersion: "master", dimensions: 1024, vectors: [[Number.NaN, ...Array(1023).fill(0)]] })));
    const client = new EmbeddingClient();
    await expect(client.health()).resolves.toMatchObject({ status: "unavailable", reason: "MODEL_MISMATCH" });
    await expect(client.embed(["서울"])).rejects.toBeInstanceOf(EmbeddingClientError);
    await expect(client.embed(["서울"])).rejects.toMatchObject({ code: "EMBEDDING_INVALID_RESPONSE" });
  });

  it("converts network failures to a stable error", async () => {
    process.env.EMBEDDING_SERVICE_URL = "http://127.0.0.1:58030";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(new EmbeddingClient().embed(["서울"])).rejects.toMatchObject({ code: "EMBEDDING_UNAVAILABLE" });
  });
});
