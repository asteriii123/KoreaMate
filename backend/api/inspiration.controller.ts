import { Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ok } from './types'
import type { InspirationPlatform } from '../agents/tools/mcp-types'
import { InspirationService } from '../services/inspiration.service'
@Controller('api/v1/inspirations')
export class InspirationController {
  constructor(private readonly service: InspirationService) {}
  @Get('search') async search(@Query('query') query = '', @Query('platforms') platforms?: string) { return ok(await this.service.search(query, platforms)) }
  @Get('trends') trends() { return ok(this.service.trends()) }
  @Get(':platform/:externalId/comments') comments() { return ok({ items: [], notice: '评论接口为只读能力，配置平台 MCP 后启用' }) }
  @Post(':id/add-to-trip') addToTrip(@Param('id') id: string) { return ok({ inspirationId: id, added: true }) }
  @Get(':platform/:externalId') async detail(@Param('platform') platform: InspirationPlatform, @Param('externalId') id: string) { return ok(await this.service.detail(platform, id)) }
}
