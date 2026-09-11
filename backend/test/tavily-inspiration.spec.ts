import { McpRegistryService } from '../agents/tools/mcp-registry'
import { TavilyInspirationProvider } from '../agents/tools/tavily-inspiration'

describe('TavilyInspirationProvider', () => {
  it('maps MCP JSON results to inspiration items', async () => {
    const mcp = { callTool: jest.fn().mockResolvedValue([JSON.stringify({ results: [{ title: '首尔咖啡攻略', url: 'https://example.com/seoul', content: '首尔圣水洞咖啡路线' }] })]) } as unknown as McpRegistryService
    const provider = new TavilyInspirationProvider(mcp)
    const items = await provider.search('首尔咖啡')
    expect(items).toEqual([expect.objectContaining({ platform: 'web', title: '首尔咖啡攻略', sourceUrl: 'https://example.com/seoul', relatedCityIds: ['seoul'] })])
    expect(mcp.callTool).toHaveBeenCalledWith('tavily', 'tavily-search', expect.objectContaining({ query: '首尔咖啡 韩国旅行攻略' }))
  })

  it('maps the text format returned by tavily-mcp', async () => {
    const response = 'Detailed Results:\n\nTitle: 釜山海岸攻略\nURL: https://example.com/busan\nContent: 釜山海云台散步路线\n\nTitle: 济州攻略\nURL: https://example.com/jeju\nContent: 济州东线旅行'
    const mcp = { callTool: jest.fn().mockResolvedValue([response]) } as unknown as McpRegistryService
    const items = await new TavilyInspirationProvider(mcp).search('韩国')
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual(expect.objectContaining({ title: '釜山海岸攻略', relatedCityIds: ['busan'] }))
  })
})
