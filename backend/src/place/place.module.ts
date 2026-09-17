import { Module } from "@nestjs/common";
import { KakaoPlaceProvider } from "./kakao.js";
import { KoreaTourismPlaceProvider } from "./tourism.js";
import { PlacesController } from "./place.controller.js";
import { PlacesService } from "./place.service.js";
import { ProviderRegistryService } from "./registry.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";

@Module({
  imports: [KnowledgeModule],
  controllers: [PlacesController],
  providers: [KakaoPlaceProvider, KoreaTourismPlaceProvider, ProviderRegistryService, PlacesService],
  exports: [ProviderRegistryService, PlacesService],
})
export class PlacesModule {}
