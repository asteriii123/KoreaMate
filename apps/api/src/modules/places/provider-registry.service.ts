import { Injectable } from "@nestjs/common";
import type { ProviderStatus } from "@koreamate/contracts";
import { KakaoPlaceProvider } from "./kakao-place.provider.js";
import { KoreaTourismPlaceProvider } from "./korea-tourism-place.provider.js";
import type { PlaceProvider } from "./place-provider.js";

@Injectable()
export class ProviderRegistryService {
  constructor(
    private readonly kakao: KakaoPlaceProvider,
    private readonly tourism: KoreaTourismPlaceProvider,
  ) {}

  placeProviders(): PlaceProvider[] {
    return [this.kakao, this.tourism];
  }

  statuses(): ProviderStatus[] {
    return [
      { id: "kakao", configured: this.kakao.configured },
      { id: "korea-tourism", configured: this.tourism.configured },
      { id: "naver", configured: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) },
      { id: "weather", configured: Boolean(process.env.WEATHER_MCP_URL) },
      { id: "exchange-rate", configured: Boolean(process.env.EXCHANGE_RATE_MCP_URL) },
    ];
  }
}
