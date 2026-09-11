import { Injectable } from '@nestjs/common'
import { BaseInspirationProvider } from './base-inspiration-provider'
@Injectable()
export class BilibiliProvider extends BaseInspirationProvider {
  readonly platform = 'bilibili' as const
  readonly enabled = true
  protected readonly samples = [{ type: 'video' as const, title: '济州岛不自驾怎么玩', summary: '用巴士和包车组合安排城山日出峰与东部海岸。', authorName: '慢游研究所', sourceUrl: 'https://www.bilibili.com/', relatedCityIds: ['jeju'], relatedPlaceIds: ['seongsan'], metrics: { views: 68000, likes: 3200 } }]
}
