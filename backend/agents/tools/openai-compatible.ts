import { Injectable } from '@nestjs/common'
import type { LlmProvider, LlmRequest, LlmResponse } from './llm-types'

@Injectable()
export class OpenAiCompatibleProvider implements LlmProvider {
  async generateText(request: LlmRequest): Promise<LlmResponse> {
    const baseUrl = process.env.LLM_BASE_URL
    const apiKey = process.env.LLM_API_KEY
    const model = process.env.LLM_MODEL
    if (!baseUrl || !apiKey || !model) return { text: '', provider: 'local-fallback' }
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'system', content: request.system ?? 'You are KoreaMate.' }, { role: 'user', content: request.prompt }] }), signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`LLM request failed: ${response.status}`)
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    return { text: body.choices?.[0]?.message?.content ?? '', provider: 'remote' }
  }
}
