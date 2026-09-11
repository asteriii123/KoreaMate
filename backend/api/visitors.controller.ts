import { Controller, Get } from '@nestjs/common'
import { ok } from './types'
import { VisitorId } from './visitor.decorator'
@Controller('api/v1/me')
export class VisitorsController { @Get() me(@VisitorId() visitorId: string) { return ok({ id: visitorId, kind: 'anonymous' }) } }
