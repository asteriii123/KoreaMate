import type { InspirationItem, InspirationPlatform, InspirationProvider } from './mcp-types'
export abstract class BaseInspirationProvider implements InspirationProvider {
  abstract readonly platform: InspirationPlatform
  abstract readonly enabled: boolean
  protected abstract readonly samples: Omit<InspirationItem, 'id' | 'externalId' | 'platform' | 'fetchedAt'>[]
  async search(query: string) {
    const normalized = query.trim().toLowerCase()
    return this.samples.filter((item) => !normalized || `${item.title}${item.summary}`.toLowerCase().includes(normalized) || normalized.includes('韩国') || normalized.includes('首尔')).map((item, index) => ({ ...item, id: `${this.platform}-${index + 1}`, externalId: `demo-${index + 1}`, platform: this.platform, fetchedAt: new Date().toISOString() }))
  }
}
