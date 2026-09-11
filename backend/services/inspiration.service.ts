import { Injectable, NotFoundException } from '@nestjs/common'
import { BilibiliProvider } from '../agents/tools/bilibili'
import { DouyinProvider } from '../agents/tools/douyin'
import { KstayProvider } from '../agents/tools/kstay'
import { WeiboProvider } from '../agents/tools/weibo'
import { XiaohongshuProvider } from '../agents/tools/xiaohongshu'
import { TavilyInspirationProvider } from '../agents/tools/tavily-inspiration'
import type { InspirationItem, InspirationPlatform, InspirationProvider } from '../agents/tools/mcp-types'
@Injectable()
export class InspirationService {
  private readonly cache = new Map<string, InspirationItem>()
  private readonly providers: InspirationProvider[]
  constructor(xhs: XiaohongshuProvider, douyin: DouyinProvider, bilibili: BilibiliProvider, weibo: WeiboProvider, kstay: KstayProvider, tavily: TavilyInspirationProvider) { this.providers = [tavily, xhs, douyin, bilibili, weibo, kstay] }
  async search(query: string, platforms?: string) {
    const selected = platforms?.split(',').filter(Boolean) as InspirationPlatform[] | undefined
    const enabled = this.providers.filter((p) => p.enabled && (!selected?.length || selected.includes(p.platform)))
    const settled = await Promise.allSettled(enabled.map((provider) => provider.search(query)))
    const results = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    const failed = settled.filter((result) => result.status === 'rejected').length
    const liveEnabled = enabled.some((provider) => provider.platform === 'web')
    results.forEach((item) => this.cache.set(item.id, item))
    return { items: results, nextCursor: null, degraded: failed > 0 || !liveEnabled, notice: failed > 0 ? `有 ${failed} 个实时来源连接失败，已显示其他可用结果` : liveEnabled ? undefined : '当前展示本地攻略示例；配置只读 MCP 后启用实时搜索' }
  }
  async detail(platform: InspirationPlatform, externalId: string) { const item = [...this.cache.values()].find((x) => x.platform === platform && x.externalId === externalId) ?? (await this.search('', platform)).items.find((x) => x.externalId === externalId); if (!item) throw new NotFoundException('攻略内容不存在或已过期'); return item }
  trends() { return [{ id: 'seoul-cafe', label: '首尔咖啡巡游', cityId: 'seoul' }, { id: 'busan-coast', label: '釜山海岸散步', cityId: 'busan' }, { id: 'jeju-east', label: '济州东线慢旅行', cityId: 'jeju' }] }
}
