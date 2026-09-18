import { Module } from "@nestjs/common";
import { PlacesModule } from "../place/place.module.js";
import { AgentToolController } from "./agent-tool.controller.js";
import { CrewAiClientService } from "./crewai-client.service.js";

@Module({ imports: [PlacesModule], controllers: [AgentToolController], providers: [CrewAiClientService], exports: [CrewAiClientService] })
export class AgentModule {}
