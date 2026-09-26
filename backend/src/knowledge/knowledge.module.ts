import { Module } from "@nestjs/common";
import { EmbeddingClient } from "./embed.js";
import { KnowledgeIngestionService } from "./ingest.js";
import { DatabaseModule } from "../database/database.module.js";
import { KnowledgeSearchService } from "./search.js";
import { KnowledgeBackfillService } from "./backfill.js";
import { KnowledgeController } from "./knowledge.controller.js";

@Module({ imports: [DatabaseModule], controllers: [KnowledgeController], providers: [EmbeddingClient, KnowledgeIngestionService, KnowledgeSearchService, KnowledgeBackfillService], exports: [EmbeddingClient, KnowledgeIngestionService, KnowledgeSearchService] })
export class KnowledgeModule {}
