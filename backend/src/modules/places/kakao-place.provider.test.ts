import { afterEach, describe, expect, it, vi } from "vitest";
import { KakaoPlaceProvider } from "./kakao-place.provider.js";
import { PlaceProviderNotConfiguredError } from "./place-provider.js";

describe("KakaoPlaceProvider", () => {
  afterEach(() => { delete process.env.KAKAO_REST_API_KEY; vi.unstubAllGlobals(); });

  it("fails explicitly without a REST API key", async () => {
    await expect(new KakaoPlaceProvider().search("景福宫")).rejects.toBeInstanceOf(PlaceProviderNotConfiguredError);
  });

  it("normalizes Kakao place search results", async () => {
    process.env.KAKAO_REST_API_KEY = "test";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [{ id: "1", place_name: "경복궁", category_name: "문화유적", address_name: "서울 종로구", road_address_name: "", x: "126.9769", y: "37.5796", place_url: "https://place.map.kakao.com/1" }] }) }));
    await expect(new KakaoPlaceProvider().search("景福宫")).resolves.toEqual([expect.objectContaining({ provider: "kakao", name: "경복궁", latitude: 37.5796, longitude: 126.9769 })]);
  });
});
