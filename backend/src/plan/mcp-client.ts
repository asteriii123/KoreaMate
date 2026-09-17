import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

@Injectable()
export class RemoteMcpClientService implements OnModuleDestroy {
  private readonly clients = new Map<string, Promise<Client>>();

  async call(url: string, tool: string, args: Record<string, unknown>): Promise<unknown> {
    const client = await this.client(url);
    try {
      return await client.callTool({ name: tool, arguments: args }, undefined, { timeout: 45_000 });
    } catch (error) {
      this.clients.delete(url);
      await client.close().catch(() => undefined);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    const clients = await Promise.allSettled([...this.clients.values()]);
    await Promise.all(clients.flatMap((result) => result.status === "fulfilled" ? [result.value.close().catch(() => undefined)] : []));
  }

  private client(url: string): Promise<Client> {
    const existing = this.clients.get(url);
    if (existing) return existing;
    const pending = this.connect(url);
    this.clients.set(url, pending);
    pending.catch(() => this.clients.delete(url));
    return pending;
  }

  private async connect(url: string): Promise<Client> {
    const client = new Client({ name: "koreamate-api", version: "3.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)), { timeout: 15_000 });
    return client;
  }
}
