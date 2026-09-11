import { Injectable, NotFoundException } from '@nestjs/common'
import { cities, places } from '../data/catalog'
@Injectable()
export class DiscoverService {
  listCities() { return cities }
  getCity(id: string) { const city = cities.find((item) => item.id === id); if (!city) throw new NotFoundException('没有找到这个城市'); return { ...city, places: places.filter((item) => item.cityId === id) } }
  listPlaces(filters: { cityId?: string; category?: string; query?: string }) { const q = filters.query?.toLowerCase(); return places.filter((p) => (!filters.cityId || p.cityId === filters.cityId) && (!filters.category || p.category === filters.category) && (!q || `${p.name}${p.koreanName}${p.tags.join('')}`.toLowerCase().includes(q))) }
  getPlace(id: string) { const place = places.find((item) => item.id === id); if (!place) throw new NotFoundException('没有找到这个地点'); return place }
}
