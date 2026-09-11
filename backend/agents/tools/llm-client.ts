import { Injectable } from '@nestjs/common'
import { OpenAiCompatibleProvider } from './openai-compatible'
import type { LlmRequest } from './llm-types'
@Injectable()
export class LlmService {
  constructor(private readonly provider: OpenAiCompatibleProvider) {}
  generateText(request: LlmRequest) { return this.provider.generateText(request) }
}
