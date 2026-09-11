import { Injectable } from '@nestjs/common'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { McpProviderConfig } from './mcp-types'

interface ToolCallResult { isError?: boolean; content: Array<{ type: string; text?: string }> }

@Injectable()
export class McpClientService {
  private readonly clients = new Map<string, Client>()

  async callTool(provider: McpProviderConfig, toolName: string, args: Record<string, unknown>): Promise<string[]> {
    const client = await this.connect(provider)
    const result = await this.withTimeout(client.callTool({ name: toolName, arguments: args }), provider.timeoutMs) as unknown as ToolCallResult
    if (result.isError) throw new Error(`MCP 工具「${toolName}」返回错误`)
    const texts: string[] = []
    for (const block of result.content) {
      if (block.type === 'text' && typeof block.text === 'string') texts.push(block.text)
    }
    return texts
  }

  async listTools(provider: McpProviderConfig): Promise<string[]> {
    const client = await this.connect(provider)
    const result = await this.withTimeout(client.listTools(), provider.timeoutMs)
    return result.tools.map((tool) => tool.name)
  }

  private async connect(provider: McpProviderConfig): Promise<Client> {
    const cached = this.clients.get(provider.id)
    if (cached) return cached
    const client = new Client({ name: 'koreamate', version: '0.1.0' })
    await this.withTimeout(client.connect(this.buildTransport(provider)), 30000)
    this.clients.set(provider.id, client)
    return client
  }

  private buildTransport(provider: McpProviderConfig) {
    if (provider.transport === 'stdio') {
      const [command, ...args] = (provider.command ?? '').split(' ')
      return new StdioClientTransport({ command, args })
    }
    return new StreamableHTTPClientTransport(new URL(provider.endpoint ?? ''))
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`MCP 调用超时（${ms}ms）`)), ms)
      promise.then((value) => { clearTimeout(timer); resolve(value) }, (error) => { clearTimeout(timer); reject(error) })
    })
  }
}
