import { Controller, Delete, Get } from '@nestjs/common'
import { ok } from './types'
@Controller('api/v1/history')
export class HistoryController { @Get() list() { return ok([]) } @Delete() clear() { return ok({ removed: true }) } }
