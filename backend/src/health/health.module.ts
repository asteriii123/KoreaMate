import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";

@Module({ imports: [KnowledgeModule], controllers: [HealthController] })
export class HealthModule {}
