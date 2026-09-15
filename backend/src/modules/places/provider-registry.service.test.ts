import { afterEach, describe, expect, it } from "vitest";
import { ProviderRegistryService } from "./provider-registry.service.js";

describe("ProviderRegistryService", () => {
  afterEach(() => {
    delete process.env.KOREA_TOURISM_API_KEY;
    delete process.env.KOREA_TOURISM_MCP_URL;
  });

  it("only reports TourAPI configured when both the key and MCP URL exist", () => {
    const registry = new ProviderRegistryService({ configured: false } as never, { configured: false } as never);
    process.env.KOREA_TOURISM_MCP_URL = "http://localhost:58000/mcp";
    expect(registry.statuses()).toContainEqual({ id: "korea-tourism", configured: false });
    process.env.KOREA_TOURISM_API_KEY = "test";
    expect(registry.statuses()).toContainEqual({ id: "korea-tourism", configured: true });
  });
});
