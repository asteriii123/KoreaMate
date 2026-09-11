import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common'
import { CoordinatorService } from '../agents/coordinator'
import { ok } from './types'
import { CreateTravelPlanDto } from './requests'
@Controller('api/v1/travel-plans')
export class TravelController { constructor(private readonly coordinator: CoordinatorService) {} @Post() create(@Body() input: CreateTravelPlanDto) { return ok(this.coordinator.create(input)) } @Get(':planId') get(@Param('planId') id: string) { const plan = this.coordinator.getPlan(id); if (!plan) throw new NotFoundException('行程不存在或尚未生成完成'); return ok(plan) } }
