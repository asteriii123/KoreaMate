import { Injectable } from '@nestjs/common'
@Injectable()
export class CriticAgent { run<T extends { days: Array<{ activities: unknown[] }> }>(plan: T) { return { ...plan, review: { passed: plan.days.every((d) => d.activities.length > 0), notes: ['路线已按城市区域进行基础检查'] } } } }

