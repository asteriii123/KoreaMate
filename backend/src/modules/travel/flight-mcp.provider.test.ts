import { describe, expect, it } from "vitest";
import { FlightMcpProvider } from "./flight-mcp.provider.js";

describe("FlightMcpProvider", () => {
  it("normalizes and deduplicates VariFlight itineraries", async () => {
    process.env.FLIGHT_MCP_URL = "https://example.com/mcp";
    process.env.VARIFLIGHT_API_KEY = "test";
    const data = "最低价航班为： 航班号：OZ368，起飞时间：2026-10-20 01:05:00，到达时间：2026-10-20 04:05:00，耗时：2h，无需中转，经济舱价格：801元\n1. 航班号：OZ368，起飞时间：2026-10-20 01:05:00，到达时间：2026-10-20 04:05:00，耗时：2h，无需中转，经济舱价格：801元\n2. 航班号：SC4664、SC4611，起飞时间：2026-10-20 15:20:00，到达时间：2026-10-21 12:50:00，耗时：20h30m，中转城市：青岛，经济舱价格：766元";
    const mcp = { call: async (): Promise<unknown> => ({ content: [{ type: "text", text: JSON.stringify({ code: 200, data }) }] }) };
    const provider = new FlightMcpProvider(mcp as never);
    const result = await provider.search({ fromCity: "上海", toCity: "首尔", departureDate: "2026-10-20" });
    expect(result.flights).toHaveLength(2);
    expect(result.flights[0]).toMatchObject({ flightNumbers: "OZ368", direct: true, price: 801 });
    expect(result.flights[1]).toMatchObject({ direct: false, transferCity: "青岛", price: 766 });
  });
});
