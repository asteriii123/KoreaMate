import { BadRequestException, Controller, Get, Query } from '@nestjs/common'
import { ok } from './types'
import { HotelsService } from '../services/hotels.service'

@Controller('api/v1')
export class HotelsController {
  constructor(private readonly service: HotelsService) {}

  @Get('hotels/search')
  async search(
    @Query('destination') destination?: string,
    @Query('checkIn') checkIn?: string,
    @Query('checkOut') checkOut?: string,
    @Query('guests') guests?: string,
    @Query('starRating') starRating?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('size') size?: string,
  ) {
    if (!destination) throw new BadRequestException('缺少必填参数 destination')
    return ok(await this.service.search({
      destination,
      checkIn,
      checkOut,
      guests: guests ? Number(guests) : undefined,
      starRating,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      size: size ? Number(size) : undefined,
    }))
  }
}
