import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { OpenAiCompatibleTravelProvider } from "./openai-compatible-travel.provider.js";
import { TRAVEL_PROVIDER } from "./travel-provider.js";
import { TravelService } from "./travel.service.js";
import { TravelController } from "./travel.controller.js";

@Module({
  imports: [DatabaseModule],
  controllers: [TravelController],
  providers: [
    TravelService,
    OpenAiCompatibleTravelProvider,
    { provide: TRAVEL_PROVIDER, useExisting: OpenAiCompatibleTravelProvider },
  ],
  exports: [TravelService],
})
export class TravelModule {}
