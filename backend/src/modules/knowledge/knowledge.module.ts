import { Module } from "@nestjs/common";
import { EmbeddingClient } from "./embedding.client.js";

@Module({ providers: [EmbeddingClient], exports: [EmbeddingClient] })
export class KnowledgeModule {}
