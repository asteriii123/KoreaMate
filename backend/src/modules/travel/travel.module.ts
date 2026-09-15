import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { PlacesModule } from "../places/places.module.js";
import { OpenAiCompatibleTravelProvider } from "./openai-compatible-travel.provider.js";
import { OpenMeteoWeatherProvider } from "./open-meteo-weather.provider.js";
import { FrankfurterExchangeProvider } from "./frankfurter-exchange.provider.js";
import { TRAVEL_PROVIDER } from "./travel-provider.js";
import { TravelService } from "./travel.service.js";
import { TravelController } from "./travel.controller.js";
import { TripContextService } from "./trip-context.service.js";
import { GuideImportService } from "./guide-import.service.js";

@Module({
  imports: [DatabaseModule, PlacesModule],
  controllers: [TravelController],
  providers: [
    TravelService,
    GuideImportService,
    TripContextService,
    OpenMeteoWeatherProvider,
    FrankfurterExchangeProvider,
    OpenAiCompatibleTravelProvider,
    { provide: TRAVEL_PROVIDER, useExisting: OpenAiCompatibleTravelProvider },
  ],
  exports: [TravelService],
})
export class TravelModule {}
