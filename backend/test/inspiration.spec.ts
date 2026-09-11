import { BilibiliProvider } from '../agents/tools/bilibili'
import { DouyinProvider } from '../agents/tools/douyin'
import { WeiboProvider } from '../agents/tools/weibo'
import { KstayProvider } from '../agents/tools/kstay'
import { XiaohongshuProvider } from '../agents/tools/xiaohongshu'
import { InspirationService } from '../services/inspiration.service'
import { TavilyInspirationProvider } from '../agents/tools/tavily-inspiration'
import { McpRegistryService } from '../agents/tools/mcp-registry'

describe('InspirationService', () => { it('only searches enabled read-only providers', async () => { const mcp = { callTool: jest.fn() } as unknown as McpRegistryService; const tavily = new TavilyInspirationProvider(mcp); const service = new InspirationService(new XiaohongshuProvider(mcp), new DouyinProvider(), new BilibiliProvider(), new WeiboProvider(), new KstayProvider({ fetcher: async () => ({ ok: true, json: async () => ({ listings: [], by_month: {} }) }) }), tavily); const result = await service.search('', undefined); expect(result.items.map((x) => x.platform)).toEqual(['douyin', 'bilibili']); expect(result.degraded).toBe(true) }) })
