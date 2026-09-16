import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@koreamate/contracts";
import { EmbeddingClient } from "../knowledge/embedding.client.js";

@Controller("health")
export class HealthController {
  constructor(private readonly embeddings: EmbeddingClient) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    return { status: "ok", service: "koreamate-api", version: "3.0.0", knowledgeEmbedding: await this.embeddings.health() };
  }
}
