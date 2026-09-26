import { Module } from "@nestjs/common";
import { MemoryController } from "./memory.controller.js";
import { MemoryService } from "./memory.service.js";
import { OpenAiCompatibleMemoryExtractor } from "./memory-llm.js";

@Module({ controllers: [MemoryController], providers: [MemoryService, OpenAiCompatibleMemoryExtractor], exports: [MemoryService, OpenAiCompatibleMemoryExtractor] })
export class MemoryModule {}
