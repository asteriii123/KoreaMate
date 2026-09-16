import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

const OcrResultSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  lines: z.array(z.object({ text: z.string(), confidence: z.number().min(0).max(1) })),
});

export type OcrResult = z.infer<typeof OcrResultSchema>;

@Injectable()
export class PaddleOcrProvider implements OnModuleDestroy {
  private clientPromise: Promise<Client> | null = null;

  async recognize(image: string): Promise<OcrResult> {
    const url = process.env.PADDLEOCR_MCP_URL;
    if (!url) throw new Error("PADDLEOCR_MCP_URL is not configured");
    const result = await (await this.client(url)).callTool({ name: "ocr", arguments: { input_data: image } }, undefined, { timeout: 90_000 });
    const content = result.content as Array<{ type?: string; text?: string }>;
    const text = content.find((item) => item.type === "text")?.text;
    if (!text || result.isError) throw new Error(text || "OCR returned no content");
    return OcrResultSchema.parse(JSON.parse(text));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.clientPromise) await (await this.clientPromise).close().catch(() => undefined);
  }

  private client(url: string): Promise<Client> {
    if (!this.clientPromise) this.clientPromise = this.connect(url).catch((error) => { this.clientPromise = null; throw error; });
    return this.clientPromise;
  }

  private async connect(url: string): Promise<Client> {
    const client = new Client({ name: "koreamate-image-translation", version: "3.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)), { timeout: 15_000 });
    return client;
  }
}
