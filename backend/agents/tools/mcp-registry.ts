import { Injectable } from '@nestjs/common'
import type { McpProviderConfig } from './mcp-types'
import { McpClientService } from './mcp-client'
@Injectable()
export class McpRegistryService {
  constructor(private readonly client: McpClientService) {}
  private readonly providers: McpProviderConfig[] = [
    { id: 'tavily', enabled: Boolean(process.env.TAVILY_API_KEY), transport: 'stdio', command: 'npx -y tavily-mcp@0.1.4', allowedTools: ['tavily-search', 'tavily-extract'], timeoutMs: 10000, maxRetries: 1 },
    { id: 'xiaohongshu-automation', enabled: process.env.XHS_AUTOMATION_ENABLED === 'true', transport: 'stdio', command: 'node dist/mcp/xhs-readonly-server.js', allowedTools: ['xiaohongshu_search_notes', 'xiaohongshu_analyze_note'], timeoutMs: 120000, maxRetries: 0 },
    { id: 'hotel-recommend', enabled: true, transport: 'stdio', command: 'uvx mcp-hotel-recommend', allowedTools: ['hotel_search_and_recommend'], timeoutMs: 10000, maxRetries: 1 },
    { id: 'socialdatax', enabled: Boolean(process.env.SOCIALDATAX_API_KEY), transport: 'streamable-http', allowedTools: ['search_notes', 'get_note', 'get_comments', 'get_creator'], timeoutMs: 10000, maxRetries: 1 },
    { id: 'redfox', enabled: Boolean(process.env.REDFOX_API_KEY), transport: 'stdio', command: 'npx -y redfox-mcp-server', allowedTools: ['search', 'get_detail', 'get_comments', 'get_profile'], timeoutMs: 10000, maxRetries: 1 },
  ]
  list() { return this.providers.map((item) => ({ ...item, command: item.command ? item.command.split(' ')[0] : undefined })) }
  get(id: string) { return this.providers.find((provider) => provider.id === id) }
  async callTool(id: string, toolName: string, args: Record<string, unknown>) {
    const provider = this.get(id)
    if (!provider || !provider.enabled) throw new Error(`MCP provider「${id}」未启用`)
    if (!provider.allowedTools.includes(toolName)) throw new Error(`MCP 工具「${toolName}」不在允许列表中`)
    return this.client.callTool(provider, toolName, args)
  }

  async status() {
    return Promise.all(this.providers.map(async (provider) => {
      if (!provider.enabled) return { id: provider.id, enabled: false, connected: false, tools: [] as string[] }
      try {
        const tools = await this.client.listTools(provider)
        return { id: provider.id, enabled: true, connected: true, tools: tools.filter((tool) => provider.allowedTools.includes(tool)) }
      } catch (error) {
        return { id: provider.id, enabled: true, connected: false, tools: [] as string[], error: error instanceof Error ? error.message : '连接失败' }
      }
    }))
  }
}
