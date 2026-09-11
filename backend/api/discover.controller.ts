import { Controller, Get, Param, Query } from '@nestjs/common'
import { ok } from './types'
import { DiscoverService } from '../services/discover.service'
@Controller('api/v1')
export class DiscoverController {
  constructor(private readonly service: DiscoverService) {}
  @Get('cities') cities() { return ok(this.service.listCities()) }
  @Get('cities/:cityId') city(@Param('cityId') id: string) { return ok(this.service.getCity(id)) }
  @Get('places') places(@Query('cityId') cityId?: string, @Query('category') category?: string, @Query('query') query?: string) { return ok(this.service.listPlaces({ cityId, category, query })) }
  @Get('places/:placeId') place(@Param('placeId') id: string) { return ok(this.service.getPlace(id)) }
}
