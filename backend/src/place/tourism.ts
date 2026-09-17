import { Injectable } from "@nestjs/common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { PlaceProviderNotConfiguredError, type ExternalPlace, type PlaceProvider } from "./place-provider.js";

const TourismItemSchema = z.object({
  contentid: z.coerce.string().min(1),
  title: z.string().min(1),
  addr1: z.string().optional(),
  mapx: z.coerce.number().min(-180).max(180),
  mapy: z.coerce.number().min(-90).max(90),
  contenttypeid: z.coerce.string().optional(),
});

@Injectable()
export class KoreaTourismPlaceProvider implements PlaceProvider {
  readonly id = "korea-tourism" as const;
  get configured(): boolean { return Boolean(process.env.KOREA_TOURISM_MCP_URL); }

  async search(query: string): Promise<ExternalPlace[]> {
    const endpoint = process.env.KOREA_TOURISM_MCP_URL;
    if (!endpoint) throw new PlaceProviderNotConfiguredError(this.id);
    const client = new Client({ name: "koreamate-api", version: "3.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(endpoint));
    try {
      await client.connect(transport);
      const result = await client.request({
        method: "tools/call",
        params: { name: "search_tourism_by_keyword", arguments: { keyword: query, language: "zh-CN", rows: 5 } },
      }, CallToolResultSchema);
      const text = result.content.find((item) => item.type === "text")?.text;
      if (!text) return [];
      const parsed: unknown = JSON.parse(text);
      const candidates = this.findItems(parsed);
      return candidates.flatMap((candidate) => {
        const item = TourismItemSchema.safeParse(candidate);
        return item.success ? [{
          provider: this.id,
          externalId: item.data.contentid,
          name: item.data.title,
          address: item.data.addr1 ?? null,
          latitude: item.data.mapy,
          longitude: item.data.mapx,
          category: item.data.contenttypeid ?? null,
          sourceUrl: null,
          raw: candidate,
        }] : [];
      });
    } finally {
      await transport.close().catch(() => undefined);
    }
  }

  private findItems(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    for (const key of ["items", "item", "results", "data"]) {
      const found = this.findItems(record[key]);
      if (found.length > 0) return found;
    }
    return [];
  }
}
