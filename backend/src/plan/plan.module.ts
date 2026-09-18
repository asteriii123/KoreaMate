import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { PlacesModule } from "../place/place.module.js";
import { OpenAiCompatibleTravelProvider } from "./plan-llm.js";
import { OpenMeteoWeatherProvider } from "./weather.js";
import { FrankfurterExchangeProvider } from "./exchange.js";
import { TRAVEL_PROVIDER } from "./plan-provider.js";
import { TravelService } from "./plan.service.js";
import { TravelController } from "./plan.controller.js";
import { TripContextService } from "./plan-context.js";
import { GuideImportService } from "./import-guide.js";
import { RemoteMcpClientService } from "./mcp-client.js";
import { HotelMcpProvider } from "./hotels.js";
import { FlightMcpProvider } from "./flights.js";
import { SavedPlacesModule } from "../saved/saved.module.js";
import { MemoryModule } from "../memory/memory.module.js";
import { CitationsModule } from "../citation/citation.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";

@Module({
  imports: [DatabaseModule, PlacesModule, SavedPlacesModule, MemoryModule, CitationsModule, KnowledgeModule],
  controllers: [TravelController],
  providers: [
    TravelService,
    GuideImportService,
    RemoteMcpClientService,
    HotelMcpProvider,
    FlightMcpProvider,
    TripContextService,
    OpenMeteoWeatherProvider,
    FrankfurterExchangeProvider,
    OpenAiCompatibleTravelProvider,
    { provide: TRAVEL_PROVIDER, useExisting: OpenAiCompatibleTravelProvider },
  ],
  exports: [TravelService, HotelMcpProvider, FlightMcpProvider, RemoteMcpClientService],
})
export class TravelModule {}
