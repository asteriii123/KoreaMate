import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ok } from './types'
import { VisitorId } from './visitor.decorator'
import { FavoritesService, type FavoriteRecord } from '../services/favorites.service'
@Controller('api/v1/favorites')
export class FavoritesController { constructor(private readonly service: FavoritesService) {} @Get() list(@VisitorId() visitorId: string) { return ok(this.service.list(visitorId)) } @Post() add(@VisitorId() visitorId: string, @Body() body: { targetType: FavoriteRecord['targetType']; targetId: string }) { return ok(this.service.add(visitorId, body.targetType, body.targetId)) } @Delete(':id') remove(@VisitorId() visitorId: string, @Param('id') id: string) { return ok(this.service.remove(visitorId, id)) } }
