import { Injectable } from '@nestjs/common'
import { DiscoverService } from '../services/discover.service'
import { InspirationService } from '../services/inspiration.service'
import type { CreateTravelPlanDto } from '../api/requests'
@Injectable()
export class ResearchAgent {
  constructor(private readonly discover: DiscoverService, private readonly inspiration: InspirationService) {}
  async run(input: CreateTravelPlanDto) {
    const cityNames: Record<string, string> = { seoul: '首尔', busan: '釜山', jeju: '济州' }
    const query = [cityNames[input.cityId] ?? input.cityId, ...input.interests, input.note].filter(Boolean).join(' ').slice(0, 100)
    const inspirations = (await this.inspiration.search(query, undefined)).items
    return { places: this.discover.listPlaces({ cityId: input.cityId }), inspirations: inspirations.filter((item) => !item.relatedCityIds.length || item.relatedCityIds.includes(input.cityId)).slice(0, 8) }
  }
}
