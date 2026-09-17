import { describe, expect, it } from "vitest";
import { HotelMcpProvider } from "./hotels.js";
import { CitationFactory } from "../citation/citation.factory.js";

describe("HotelMcpProvider", () => {
  it("normalizes a RollingGo hotel response", async () => {
    process.env.HOTEL_MCP_URL = "https://example.com/mcp";
    const mcp = { call: async (): Promise<unknown> => ({ content: [{ type: "text", text: JSON.stringify({ ok: true, destination: "首尔", checkIn: "2026-10-20", checkOut: "2026-10-22", hotels: [{ hotelId: 5956, name: "里维埃拉酒店", starRating: 4, lowestPrice: 1017, currency: "CNY", address: "江南区", imageUrl: null, bookingUrl: "https://rollinggo.cn/hotel/5956", recommendReason: "性价比之选", cancellation: "免费取消" }] }) }] }) };
    const provider = new HotelMcpProvider(mcp as never, new CitationFactory());
    const result = await provider.search({ destination: "首尔", checkIn: "2026-10-20", checkOut: "2026-10-22", guests: 2 });
    expect(result.hotels[0]).toMatchObject({ id: "5956", name: "里维埃拉酒店", lowestPrice: 1017 });
  });
});
