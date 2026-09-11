import { DiscoverService } from '../services/discover.service'
describe('DiscoverService', () => { const service = new DiscoverService(); it('filters places by city', () => { expect(service.listPlaces({ cityId: 'seoul' })).toHaveLength(2) }); it('returns three cities', () => { expect(service.listCities()).toHaveLength(3) }) })
