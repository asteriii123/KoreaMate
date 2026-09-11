import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const baseUrl = (process.env.FASTAPI_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const server = new Server({ name: 'koreamate-xiaohongshu-readonly', version: '0.1.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [
  { name: 'xiaohongshu_search_notes', description: '搜索小红书笔记', inputSchema: { type: 'object', properties: { keywords: { type: 'string', minLength: 1, maxLength: 100 }, limit: { type: 'integer', minimum: 1, maximum: 5, default: 5 } }, required: ['keywords'], additionalProperties: false } },
  { name: 'xiaohongshu_analyze_note', description: '分析一篇小红书笔记', inputSchema: { type: 'object', properties: { url: { type: 'string', minLength: 10, pattern: '.*(xiaohongshu\\.com|xhslink\\.com).*' } }, required: ['url'], additionalProperties: false } },
] }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments ?? {}
  let endpoint: URL
  if (request.params.name === 'xiaohongshu_search_notes') {
    endpoint = new URL('/search_notes', baseUrl)
    endpoint.searchParams.set('keywords', String(args.keywords ?? ''))
    endpoint.searchParams.set('limit', String(Math.min(Number(args.limit ?? 5), 5)))
  } else if (request.params.name === 'xiaohongshu_analyze_note') {
    endpoint = new URL('/analyze_note', baseUrl)
    endpoint.searchParams.set('url', String(args.url ?? ''))
  } else {
    return { isError: true, content: [{ type: 'text', text: '工具不在只读允许列表中' }] }
  }
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(110000) })
    const body = await response.text()
    if (!response.ok) return { isError: true, content: [{ type: 'text', text: `小红书服务请求失败（${response.status}）` }] }
    const parsed = JSON.parse(body) as { success?: boolean; message?: string; data?: unknown[] }
    const emptySearch = request.params.name === 'xiaohongshu_search_notes' && parsed.success === false && Array.isArray(parsed.data) && parsed.data.length === 0 && parsed.message?.includes('未找到')
    if (emptySearch) return { content: [{ type: 'text', text: JSON.stringify({ ...parsed, success: true }) }] }
    return { isError: parsed.success === false, content: [{ type: 'text', text: parsed.success === false ? parsed.message ?? '小红书操作失败' : body }] }
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : '小红书服务连接失败' }] }
  }
})

async function main() { await server.connect(new StdioServerTransport()) }
void main()
