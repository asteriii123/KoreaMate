import { Injectable } from "@nestjs/common";
import { z } from "zod";

const DIMENSIONS = 1024;
const HealthSchema = z.object({
  status: z.literal("ok"),
  model: z.string().min(1),
  modelVersion: z.string().min(1),
  dimensions: z.number().int().positive(),
  loaded: z.boolean(),
});
const EmbedSchema = z.object({
  model: z.string().min(1),
  modelVersion: z.string().min(1),
  dimensions: z.number().int().positive(),
  vectors: z.array(z.array(z.number().finite())),
});

export type EmbeddingHealth = {
  status: "available" | "disabled" | "unavailable";
  model: string;
  modelVersion: string;
  dimensions: number;
  loaded: boolean | null;
  reason: string | null;
};

export class EmbeddingClientError extends Error {
  constructor(readonly code: "EMBEDDING_DISABLED" | "EMBEDDING_UNAVAILABLE" | "EMBEDDING_INVALID_RESPONSE") {
    super(code);
    this.name = "EmbeddingClientError";
  }
}

@Injectable()
export class EmbeddingClient {
  private readonly url = process.env.EMBEDDING_SERVICE_URL?.replace(/\/$/u, "") ?? "";
  private readonly model = process.env.EMBEDDING_MODEL || "BAAI/bge-m3";
  private readonly modelVersion = process.env.EMBEDDING_MODEL_VERSION || "master";
  private readonly enabled = process.env.KNOWLEDGE_SEARCH_ENABLED !== "false" && Boolean(this.url);

  async health(): Promise<EmbeddingHealth> {
    if (!this.enabled) return this.healthValue("disabled", null, "NOT_CONFIGURED");
    try {
      const response = await fetch(`${this.url}/health`, { signal: AbortSignal.timeout(1_500) });
      if (!response.ok) return this.healthValue("unavailable", null, `HTTP_${response.status}`);
      const result = HealthSchema.parse(await response.json());
      if (!this.matchesService(result)) return this.healthValue("unavailable", result.loaded, "MODEL_MISMATCH");
      return this.healthValue("available", result.loaded, null);
    } catch {
      return this.healthValue("unavailable", null, "SERVICE_UNAVAILABLE");
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.enabled) throw new EmbeddingClientError("EMBEDDING_DISABLED");
    let response: Response;
    try {
      response = await fetch(`${this.url}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new EmbeddingClientError("EMBEDDING_UNAVAILABLE");
    }
    if (!response.ok) throw new EmbeddingClientError("EMBEDDING_UNAVAILABLE");
    try {
      const result = EmbedSchema.parse(await response.json());
      if (!this.matchesService(result) || result.vectors.length !== texts.length || result.vectors.some((vector) => vector.length !== DIMENSIONS)) {
        throw new EmbeddingClientError("EMBEDDING_INVALID_RESPONSE");
      }
      return result.vectors;
    } catch (error) {
      if (error instanceof EmbeddingClientError) throw error;
      throw new EmbeddingClientError("EMBEDDING_INVALID_RESPONSE");
    }
  }

  private matchesService(value: { model: string; modelVersion: string; dimensions: number }): boolean {
    return value.model === this.model && value.modelVersion === this.modelVersion && value.dimensions === DIMENSIONS;
  }

  private healthValue(status: EmbeddingHealth["status"], loaded: boolean | null, reason: string | null): EmbeddingHealth {
    return { status, model: this.model, modelVersion: this.modelVersion, dimensions: DIMENSIONS, loaded, reason };
  }
}
