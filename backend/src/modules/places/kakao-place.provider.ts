import { Injectable } from "@nestjs/common";
import { fetch as proxyFetch, ProxyAgent, type Dispatcher } from "undici";
import { z } from "zod";
import { PlaceProviderNotConfiguredError, type ExternalPlace, type PlaceProvider } from "./place-provider.js";

const KakaoResponseSchema = z.object({
  documents: z.array(z.object({
    id: z.string().min(1),
    place_name: z.string().min(1),
    category_name: z.string(),
    address_name: z.string(),
    road_address_name: z.string(),
    x: z.coerce.number().min(-180).max(180),
    y: z.coerce.number().min(-90).max(90),
    place_url: z.string(),
  })),
});

@Injectable()
export class KakaoPlaceProvider implements PlaceProvider {
  readonly id = "kakao" as const;
  private readonly dispatcher: Dispatcher | undefined = process.env.KAKAO_PROXY_URL
    ? new ProxyAgent(process.env.KAKAO_PROXY_URL)
    : undefined;
  get configured(): boolean { return Boolean(process.env.KAKAO_REST_API_KEY); }

  async search(query: string): Promise<ExternalPlace[]> {
    const key = process.env.KAKAO_REST_API_KEY;
    if (!key) throw new PlaceProviderNotConfiguredError(this.id);
    const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    url.searchParams.set("query", query);
    url.searchParams.set("size", "5");
    const headers = { Authorization: `KakaoAK ${key}` };
    const signal = AbortSignal.timeout(8_000);
    const response = this.dispatcher
      ? await proxyFetch(url, { headers, signal, dispatcher: this.dispatcher })
      : await fetch(url, { headers, signal });
    if (!response.ok) throw new Error(`Kakao returned HTTP ${response.status}`);
    const payload = KakaoResponseSchema.parse(await response.json());
    return payload.documents.map((place) => ({
      provider: this.id,
      externalId: place.id,
      name: place.place_name,
      address: place.road_address_name || place.address_name || null,
      latitude: place.y,
      longitude: place.x,
      category: place.category_name || null,
      sourceUrl: place.place_url || null,
      raw: place,
    }));
  }
}
