import { Injectable } from '@nestjs/common'
import { McpRegistryService } from '../agents/tools/mcp-registry'

export interface HotelSearchParams {
  destination: string
  checkIn?: string
  checkOut?: string
  guests?: number
  starRating?: string
  maxPrice?: number
  size?: number
}

@Injectable()
export class HotelsService {
  constructor(private readonly mcp: McpRegistryService) {}

  async search(params: HotelSearchParams) {
    const args: Record<string, unknown> = { destination: params.destination }
    if (params.checkIn) args.check_in = params.checkIn
    if (params.checkOut) args.check_out = params.checkOut
    if (params.guests) args.guests = params.guests
    if (params.starRating) args.star_rating = params.starRating
    if (params.maxPrice) args.max_price = params.maxPrice
    if (params.size) args.size = params.size
    const results = await this.mcp.callTool('hotel-recommend', 'hotel_search_and_recommend', args)
    return { provider: 'hotel-recommend', destination: params.destination, results }
  }
}
