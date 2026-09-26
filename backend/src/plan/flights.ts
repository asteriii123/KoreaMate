import { Injectable } from "@nestjs/common";
import { FlightSearchResultSchema, type FlightOption, type FlightSearchResult } from "@koreamate/contracts";
import { z } from "zod";
import { RemoteMcpClientService } from "./mcp-client.js";
import { CitationFactory } from "../citation/citation.factory.js";

const RawEnvelopeSchema = z.object({ code: z.literal(200), data: z.string() });
type ToolResult = { content?: Array<{ type: string; text?: string }>; isError?: boolean };

const CITY_CODES: Record<string, string> = {
  上海: "SHA", 北京: "BJS", 广州: "CAN", 深圳: "SZX", 成都: "CTU", 杭州: "HGH", 南京: "NKG", 武汉: "WUH", 重庆: "CKG", 厦门: "XMN", 青岛: "TAO", 西安: "SIA", 天津: "TSN",
  哈尔滨: "HRB", 沈阳: "SHE", 大连: "DLC", 长春: "CGQ", 长沙: "CSX", 郑州: "CGO", 昆明: "KMG", 济南: "TNA", 福州: "FOC", 三亚: "SYX", 海口: "HAK", 香港: "HKG", 澳门: "MFM", 台北: "TPE",
  首尔: "SEL", 仁川: "SEL", 釜山: "PUS", 济州: "CJU", 济州岛: "CJU",
};

@Injectable()
export class FlightMcpProvider {
  constructor(private readonly mcp: RemoteMcpClientService, private readonly citations: CitationFactory) {}
  get configured(): boolean { return Boolean(process.env.FLIGHT_MCP_URL && process.env.VARIFLIGHT_API_KEY); }

  cityCode(city: string): string | null {
    if (/^[A-Z]{3}$/u.test(city)) return city;
    return CITY_CODES[city.replace(/市$/u, "")] ?? null;
  }

  async search(input: { fromCity: string; toCity: string; departureDate: string }): Promise<FlightSearchResult> {
    const url = process.env.FLIGHT_MCP_URL;
    const fromCode = this.cityCode(input.fromCity);
    const toCode = this.cityCode(input.toCity);
    if (!url || !this.configured || !fromCode || !toCode) throw new Error("Flight MCP or city code is not configured");
    const result = await this.mcp.call(url, "searchFlightItineraries", { depCityCode: fromCode, arrCityCode: toCode, depDate: input.departureDate }) as ToolResult;
    if (result.isError) throw new Error("Flight MCP returned an error");
    const text = result.content?.find((item) => item.type === "text")?.text;
    if (!text) throw new Error("Flight MCP returned no data");
    const raw = RawEnvelopeSchema.parse(JSON.parse(text));
    const flights = this.parseFlights(raw.data);
    if (flights.length === 0) throw new Error("Flight MCP returned no parseable flights");
    const fetchedAt = new Date();
    return FlightSearchResultSchema.parse({ provider: "variflight", fromCity: input.fromCity, toCity: input.toCity, departureDate: input.departureDate, fetchedAt: fetchedAt.toISOString(), citation: this.citations.external({ provider: "variflight", fetchedAt, expiresAt: new Date(fetchedAt.getTime() + 15 * 60 * 1_000) }), flights });
  }

  private parseFlights(text: string): FlightOption[] {
    const pattern = /航班号：([^，\n]+)，起飞时间：([^，\n]+)，到达时间：([^，\n]+)，耗时：([^，\n]+)，(?:(?:中转城市：([^，\n]+))|(无需中转))，经济舱价格：(\d+(?:\.\d+)?)元/gu;
    const seen = new Set<string>();
    return [...text.matchAll(pattern)].flatMap((match) => {
      const id = `${match[1]}-${match[2]}`;
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ id, flightNumbers: match[1], departureAt: match[2], arrivalAt: match[3], duration: match[4], direct: Boolean(match[6]), transferCity: match[5] ?? null, price: Number(match[7]), currency: "CNY" as const }];
    }).slice(0, 8);
  }
}
