import { PlannerAgent } from '../agents/planner'

describe('PlannerAgent', () => {
  it('includes researched inspiration in the plan and references', () => {
    const input = { cityId: 'seoul', days: 1, people: 1, budget: 2000, interests: ['咖啡'], note: '' }
    const inspiration = { id: 'xhs-1', externalId: 'note-1', platform: 'xiaohongshu' as const, type: 'note' as const, title: '圣水洞咖啡路线', summary: '上午人少，建议步行串联三家咖啡店', authorName: '旅行者', sourceUrl: 'https://www.xiaohongshu.com/explore/abc', relatedCityIds: ['seoul'], relatedPlaceIds: [], fetchedAt: '2026-09-11T00:00:00.000Z' }
    const plan = new PlannerAgent().run(input, [], [inspiration])
    expect(plan.days[0].summary).toContain('圣水洞咖啡路线')
    expect(plan.days[0].activities[1].detail).toContain('上午人少')
    expect(plan.references[0].sourceUrl).toBe(inspiration.sourceUrl)
  })
})
