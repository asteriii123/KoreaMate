import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const raw = error instanceof HttpException ? error.getResponse() : null
    const message = typeof raw === 'object' && raw && 'message' in raw
      ? (Array.isArray(raw.message) ? raw.message.join('；') : String(raw.message))
      : error instanceof Error ? error.message : '服务暂时不可用'
    response.status(status).json({ success: false, error: { code: `HTTP_${status}`, message, retryable: status >= 500 }, requestId: crypto.randomUUID() })
  }
}

