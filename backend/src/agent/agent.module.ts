import { Module } from "@nestjs/common";
import { PlacesModule } from "../place/place.module.js";
import { AgentToolsController } from "./agent-tools.controller.js";
import { CrewAiBridgeService } from "./crewai-bridge.service.js";
import { OpenMeteoWeatherProvider } from "../plan/weather.js";
import { TravelModule } from "../plan/plan.module.js";
import { SavedPlacesModule } from "../saved/saved.module.js";
import { MemoryModule } from "../memory/memory.module.js";
import { TranslationModule } from "../translate/translate.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AgentRunStoreService } from "./agent-run-store.service.js";
import { CitationsModule } from "../citation/citation.module.js";
import { StreamingLlmService } from "./streaming-llm.service.js";

@Module({ imports: [DatabaseModule, CitationsModule, PlacesModule, TravelModule, SavedPlacesModule, MemoryModule, TranslationModule], controllers: [AgentToolsController], providers: [CrewAiBridgeService, AgentRunStoreService, OpenMeteoWeatherProvider, StreamingLlmService], exports: [CrewAiBridgeService, AgentRunStoreService, StreamingLlmService] })
export class AgentModule {}
