import { buildMockPlan, mockTranslation } from '../data'
import type { TravelPreferences } from '../types'
const wait = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms))
export const mockApi = {
  async translate(text: string) { await wait(); return { ...mockTranslation, source: text } },
  async createPlan(preferences: TravelPreferences) { await wait(650); return buildMockPlan(preferences) },
}
