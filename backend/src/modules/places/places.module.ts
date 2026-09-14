import { Module } from "@nestjs/common";
import { KakaoPlaceProvider } from "./kakao-place.provider.js";
import { KoreaTourismPlaceProvider } from "./korea-tourism-place.provider.js";
import { PlacesController } from "./places.controller.js";
import { PlacesService } from "./places.service.js";
import { ProviderRegistryService } from "./provider-registry.service.js";

@Module({
  controllers: [PlacesController],
  providers: [KakaoPlaceProvider, KoreaTourismPlaceProvider, ProviderRegistryService, PlacesService],
  exports: [ProviderRegistryService, PlacesService],
})
export class PlacesModule {}
