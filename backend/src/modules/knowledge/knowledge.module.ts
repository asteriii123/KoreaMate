import { Module } from "@nestjs/common";
import { EmbeddingClient } from "./embedding.client.js";
import { KnowledgeIngestionService } from "./knowledge-ingestion.service.js";
import { DatabaseModule } from "../database/database.module.js";
import { KnowledgeSearchService } from "./knowledge-search.service.js";
import { KnowledgeBackfillService } from "./knowledge-backfill.service.js";
import { KnowledgeController } from "./knowledge.controller.js";

@Module({ imports: [DatabaseModule], controllers: [KnowledgeController], providers: [EmbeddingClient, KnowledgeIngestionService, KnowledgeSearchService, KnowledgeBackfillService], exports: [EmbeddingClient, KnowledgeIngestionService, KnowledgeSearchService] })
export class KnowledgeModule {}
