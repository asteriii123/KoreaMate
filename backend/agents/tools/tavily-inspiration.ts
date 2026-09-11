import { Injectable } from '@nestjs/common'
import { McpRegistryService } from './mcp-registry'
import type { InspirationItem, InspirationProvider } from './mcp-types'

interface TavilyResult { title?: string; url?: string; content?: string }

@Injectable()
export class TavilyInspirationProvider implements InspirationProvider {
  readonly platform = 'web' as const
  get enabled() { return Boolean(process.env.TAVILY_API_KEY) }

  constructor(private readonly mcp: McpRegistryService) {}

  async search(query: string): Promise<InspirationItem[]> {
    const blocks = await this.mcp.callTool('tavily', 'tavily-search', {
      query: query.trim() ? `${query.trim()} 韩国旅行攻略` : '韩国旅行攻略 首尔 釜山 济州',
      max_results: 8,
      search_depth: 'advanced',
    })
    return this.extractResults(blocks).slice(0, 8).map((result, index) => ({
      id: `web-${this.hash(result.url ?? `${result.title}-${index}`)}`,
      externalId: result.url ?? `tavily-${index + 1}`,
      platform: 'web',
      type: 'note',
      title: result.title?.trim() || '韩国旅行攻略',
      summary: (result.content?.trim() || '点击查看完整攻略').slice(0, 240),
      authorName: this.hostname(result.url),
      sourceUrl: result.url ?? '#',
      relatedCityIds: this.relatedCities(`${result.title ?? ''}${result.content ?? ''}`),
      relatedPlaceIds: [],
      fetchedAt: new Date().toISOString(),
    }))
  }

  private extractResults(blocks: string[]): TavilyResult[] {
    const results: TavilyResult[] = []
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block) as { results?: TavilyResult[] } | TavilyResult[]
        const items = Array.isArray(parsed) ? parsed : parsed.results
        if (Array.isArray(items)) results.push(...items.filter((item) => item && (item.url || item.title)))
      } catch {
        const pattern = /Title:\s*(.+)\r?\nURL:\s*(.+)\r?\nContent:\s*([\s\S]*?)(?=\r?\n\r?\nTitle:|$)/g
        for (const match of block.matchAll(pattern)) results.push({ title: match[1].trim(), url: match[2].trim(), content: match[3].trim() })
      }
    }
    return results
  }

  private relatedCities(text: string) {
    const cities: string[] = []
    if (/首尔|서울/i.test(text)) cities.push('seoul')
    if (/釜山|부산/i.test(text)) cities.push('busan')
    if (/济州|제주/i.test(text)) cities.push('jeju')
    return cities
  }

  private hostname(url?: string) {
    try { return url ? new URL(url).hostname.replace(/^www\./, '') : '网页攻略' } catch { return '网页攻略' }
  }

  private hash(value: string) {
    let hash = 0
    for (let index = 0; index < value.length; index++) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
    return Math.abs(hash).toString(36)
  }
}
