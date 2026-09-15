import { Injectable } from "@nestjs/common";
import { HotelSearchResultSchema, type HotelSearchResult } from "@koreamate/contracts";
import { z } from "zod";
import { RemoteMcpClientService } from "./remote-mcp-client.service.js";

const RawHotelSchema = z.object({
  hotelId: z.union([z.string(), z.number()]),
  name: z.string(),
  starRating: z.number().nullable().optional(),
  lowestPrice: z.number(),
  currency: z.string().length(3).default("CNY"),
  address: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  bookingUrl: z.string().url().nullable().optional(),
  recommendReason: z.string().default(""),
  cancellation: z.string().default(""),
});
const RawResultSchema = z.object({ ok: z.literal(true), destination: z.string(), checkIn: z.string(), checkOut: z.string(), hotels: z.array(RawHotelSchema) });
type ToolResult = { content?: Array<{ type: string; text?: string }>; isError?: boolean };

@Injectable()
export class HotelMcpProvider {
  constructor(private readonly mcp: RemoteMcpClientService) {}

  get configured(): boolean { return Boolean(process.env.HOTEL_MCP_URL); }

  async search(input: { destination: string; checkIn: string; checkOut: string; guests: number; query?: string }): Promise<HotelSearchResult> {
    const url = process.env.HOTEL_MCP_URL;
    if (!url) throw new Error("Hotel MCP is not configured");
    const result = await this.mcp.call(url, "hotelSearchAndRecommend", { destination: input.destination, countryCode: "KR", checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests, query: input.query ?? null, size: 6 }) as ToolResult;
    if (result.isError) throw new Error("Hotel MCP returned an error");
    const text = result.content?.find((item) => item.type === "text")?.text;
    if (!text) throw new Error("Hotel MCP returned no data");
    const raw = RawResultSchema.parse(JSON.parse(text));
    return HotelSearchResultSchema.parse({ provider: "rollinggo-hotel", destination: raw.destination, checkIn: raw.checkIn, checkOut: raw.checkOut, fetchedAt: new Date().toISOString(), hotels: raw.hotels.slice(0, 6).map((hotel) => ({ id: String(hotel.hotelId), name: hotel.name, starRating: hotel.starRating ?? null, lowestPrice: hotel.lowestPrice, currency: hotel.currency, address: hotel.address ?? null, imageUrl: hotel.imageUrl ?? null, bookingUrl: hotel.bookingUrl ?? null, recommendation: hotel.recommendReason, cancellation: hotel.cancellation })) });
  }
}
