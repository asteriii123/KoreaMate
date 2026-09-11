import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { VisitorRequest } from './visitor.middleware'
export const VisitorId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<VisitorRequest>().visitorId ?? 'anonymous')
