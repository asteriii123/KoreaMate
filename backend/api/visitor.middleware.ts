import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

export interface VisitorRequest extends Request { visitorId?: string }

@Injectable()
export class VisitorMiddleware implements NestMiddleware {
  use(req: VisitorRequest, res: Response, next: NextFunction) {
    const existing = (req.signedCookies?.km_visitor ?? req.cookies?.km_visitor) as string | undefined
    const visitorId = existing && /^[a-f0-9-]{36}$/.test(existing) ? existing : crypto.randomUUID()
    req.visitorId = visitorId
    if (!existing) res.cookie('km_visitor', visitorId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', signed: true, maxAge: 31536000000 })
    next()
  }
}
