import { McpClientService } from '../agents/tools/mcp-client'
import { McpRegistryService } from '../agents/tools/mcp-registry'

const mockClient = () => ({ callTool: jest.fn().mockResolvedValue(['推荐酒店 A']), listTools: jest.fn().mockResolvedValue(['hotel_search_and_recommend']) }) as unknown as McpClientService

describe('McpRegistryService', () => {
  it('delegates callTool to the enabled hotel-recommend provider', async () => {
    const client = mockClient()
    const registry = new McpRegistryService(client)
    const result = await registry.callTool('hotel-recommend', 'hotel_search_and_recommend', { destination: '首尔' })
    expect(result).toEqual(['推荐酒店 A'])
    expect(client.callTool).toHaveBeenCalledWith(expect.objectContaining({ id: 'hotel-recommend' }), 'hotel_search_and_recommend', { destination: '首尔' })
  })

  it('rejects unknown providers', async () => {
    const registry = new McpRegistryService(mockClient())
    await expect(registry.callTool('rollinggo', 'searchHotels', {})).rejects.toThrow('未启用')
  })

  it('rejects tools outside the provider allowlist', async () => {
    const registry = new McpRegistryService(mockClient())
    await expect(registry.callTool('hotel-recommend', 'book_hotel', {})).rejects.toThrow('允许列表')
  })
})
