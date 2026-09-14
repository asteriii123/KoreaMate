export type ExternalPlace = {
  provider: "kakao" | "korea-tourism";
  externalId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  sourceUrl: string | null;
  raw: unknown;
};

export interface PlaceProvider {
  readonly id: ExternalPlace["provider"];
  readonly configured: boolean;
  search(query: string): Promise<ExternalPlace[]>;
}

export class PlaceProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} provider is not configured`);
  }
}
