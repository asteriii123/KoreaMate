import { Injectable, Optional } from '@nestjs/common'
import { BaseInspirationProvider } from './base-inspiration-provider'
import type { InspirationItem } from './mcp-types'

interface LodgingListing { name: string; address: string; sido: string; sigungu: string }
interface FestivalResponse { by_month?: Record<string, string[]> }
type Fetcher = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>

const SIDO_TO_CITY: Record<string, string> = { '서울특별시': 'seoul', '부산광역시': 'busan', '제주특별자치도': 'jeju' }

@Injectable()
export class KstayProvider extends BaseInspirationProvider {
  readonly platform = 'kstay' as const
  readonly enabled = true
  protected readonly samples: Omit<InspirationItem, 'id' | 'externalId' | 'platform' | 'fetchedAt'>[] = []
  private readonly baseUrl: string
  private readonly fetcher: Fetcher

  constructor(@Optional() opts: { baseUrl?: string; fetcher?: Fetcher } = {}) {
    super()
    this.baseUrl = opts.baseUrl ?? 'https://k-stay.ai'
    this.fetcher = opts.fetcher ?? ((url) => fetch(url))
  }

  async search(query: string): Promise<InspirationItem[]> {
    try {
      const [lodgings, festivals] = await Promise.all([
        this.fetchJson<{ listings?: LodgingListing[] }>(`${this.baseUrl}/api/lodging/listings?kind=hotel&limit=40`),
        this.fetchJson<FestivalResponse>(`${this.baseUrl}/api/festivals`),
      ])
      const items = [...(lodgings.listings ?? []).map((listing, index) => this.toLodging(listing, index)), ...this.toFestivals(festivals)]
      const normalized = query.trim().toLowerCase()
      return items.filter((item) => !normalized || `${item.title}${item.summary}`.toLowerCase().includes(normalized))
    } catch {
      return []
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await this.fetcher(url)
    if (!response.ok) throw new Error('k-stay fetch failed')
    return (await response.json()) as T
  }

  private toLodging(listing: LodgingListing, index: number): InspirationItem {
    return {
      id: `kstay-lodging-${index + 1}`,
      externalId: `kstay-lodging-${index + 1}`,
      platform: 'kstay',
      type: 'lodging',
      title: listing.name,
      summary: `${listing.sido} ${listing.sigungu}${listing.address ? ` · ${listing.address}` : ''}`,
      authorName: 'K-STAY · 韩国官方住宿数据',
      sourceUrl: 'https://k-stay.ai',
      relatedCityIds: SIDO_TO_CITY[listing.sido] ? [SIDO_TO_CITY[listing.sido]] : [],
      relatedPlaceIds: [],
      fetchedAt: new Date().toISOString(),
    }
  }

  private toFestivals(festivals: FestivalResponse): InspirationItem[] {
    const names = [...new Set(Object.values(festivals.by_month ?? {}).flat())]
    return names.slice(0, 20).map((name, index) => ({
      id: `kstay-festival-${index + 1}`,
      externalId: `kstay-festival-${index + 1}`,
      platform: 'kstay',
      type: 'note',
      title: name,
      summary: '韩国月度节庆活动（K-STAY 文旅数据）',
      authorName: 'K-STAY · 韩国文旅数据',
      sourceUrl: 'https://k-stay.ai',
      relatedCityIds: [],
      relatedPlaceIds: [],
      fetchedAt: new Date().toISOString(),
    }))
  }
}
