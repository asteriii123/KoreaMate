import { Injectable } from '@nestjs/common'
import { BaseInspirationProvider } from './base-inspiration-provider'
@Injectable()
export class DouyinProvider extends BaseInspirationProvider {
  readonly platform = 'douyin' as const
  readonly enabled = true
  protected readonly samples = [{ type: 'video' as const, title: '釜山海岸线一日路线', summary: '从海云台出发串联海岸列车与青沙浦，适合晴天。', authorName: '旅行镜头', sourceUrl: 'https://www.douyin.com/', relatedCityIds: ['busan'], relatedPlaceIds: ['haeundae'], metrics: { likes: 2460, comments: 188 } }]
}
