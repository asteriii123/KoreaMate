import { Module } from "@nestjs/common";
import { EmbeddingClient } from "./embedding.client.js";
import { KnowledgeIngestionService } from "./knowledge-ingestion.service.js";
import { DatabaseModule } from "../database/database.module.js";
import { KnowledgeSearchService } from "./knowledge-search.service.js";

@Module({ imports: [DatabaseModule], providers: [EmbeddingClient, KnowledgeIngestionService, KnowledgeSearchService], exports: [EmbeddingClient, KnowledgeIngestionService, KnowledgeSearchService] })
export class KnowledgeModule {}
