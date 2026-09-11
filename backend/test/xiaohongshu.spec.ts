import { McpRegistryService } from '../agents/tools/mcp-registry'
import { XiaohongshuProvider } from '../agents/tools/xiaohongshu'

describe('XiaohongshuProvider', () => {
  it('uses only search and analyze tools and maps notes', async () => {
    const callTool = jest.fn()
      .mockResolvedValueOnce(['🔍 搜索结果\n\n1. 首尔咖啡路线\n   🔗 链接: https://www.xiaohongshu.com/explore/abc'])
      .mockResolvedValueOnce(['📄 **基础信息**\n  📝 标题: 首尔咖啡路线\n  👤 作者: 旅行者\n\n📖 **内容摘要**\n  圣水洞适合安排半天咖啡巡游'])
    const provider = new XiaohongshuProvider({ callTool } as unknown as McpRegistryService)
    const items = await provider.search('首尔咖啡')
    expect(items[0]).toEqual(expect.objectContaining({ platform: 'xiaohongshu', title: '首尔咖啡路线', authorName: '旅行者', relatedCityIds: ['seoul'] }))
    expect(callTool.mock.calls.map((call) => call[1])).toEqual(['xiaohongshu_search_notes', 'xiaohongshu_analyze_note'])
  })
})
