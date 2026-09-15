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
      { id: "korea-tourism", configured: Boolean(process.env.KOREA_TOURISM_API_KEY && process.env.KOREA_TOURISM_MCP_URL) },
      { id: "naver", configured: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) },
      { id: "weather", configured: true },
      { id: "exchange-rate", configured: true },
    ];
  }
}
