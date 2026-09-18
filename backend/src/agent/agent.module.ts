import { Module } from "@nestjs/common";
import { PlacesModule } from "../place/place.module.js";
import { AgentToolController } from "./agent-tool.controller.js";
import { CrewAiClientService } from "./crewai-client.service.js";
import { OpenMeteoWeatherProvider } from "../plan/weather.js";
import { TravelModule } from "../plan/plan.module.js";
import { SavedPlacesModule } from "../saved/saved.module.js";
import { MemoryModule } from "../memory/memory.module.js";
import { TranslationModule } from "../translate/translate.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AgentRunService } from "./agent-run.service.js";

@Module({ imports: [DatabaseModule, PlacesModule, TravelModule, SavedPlacesModule, MemoryModule, TranslationModule], controllers: [AgentToolController], providers: [CrewAiClientService, AgentRunService, OpenMeteoWeatherProvider], exports: [CrewAiClientService, AgentRunService] })
export class AgentModule {}
