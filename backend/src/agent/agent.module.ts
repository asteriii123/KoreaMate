import { Module } from "@nestjs/common";
import { PlacesModule } from "../place/place.module.js";
import { AgentToolController } from "./agent-tool.controller.js";
import { CrewAiClientService } from "./crewai-client.service.js";
import { OpenMeteoWeatherProvider } from "../plan/weather.js";
import { TravelModule } from "../plan/plan.module.js";
import { SavedPlacesModule } from "../saved/saved.module.js";
import { MemoryModule } from "../memory/memory.module.js";
import { TranslationModule } from "../translate/translate.module.js";

@Module({ imports: [PlacesModule, TravelModule, SavedPlacesModule, MemoryModule, TranslationModule], controllers: [AgentToolController], providers: [CrewAiClientService, OpenMeteoWeatherProvider], exports: [CrewAiClientService] })
export class AgentModule {}
