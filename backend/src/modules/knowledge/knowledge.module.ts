import { Module } from "@nestjs/common";
import { EmbeddingClient } from "./embedding.client.js";
import { KnowledgeIngestionService } from "./knowledge-ingestion.service.js";
import { DatabaseModule } from "../database/database.module.js";

@Module({ imports: [DatabaseModule], providers: [EmbeddingClient, KnowledgeIngestionService], exports: [EmbeddingClient, KnowledgeIngestionService] })
export class KnowledgeModule {}
