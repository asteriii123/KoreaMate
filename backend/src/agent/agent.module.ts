import { Module } from "@nestjs/common";
import { PlacesModule } from "../place/place.module.js";
import { AgentToolController } from "./agent-tool.controller.js";

@Module({ imports: [PlacesModule], controllers: [AgentToolController] })
export class AgentModule {}
