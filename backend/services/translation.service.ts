import { Injectable } from '@nestjs/common'
import { LlmService } from '../agents/tools/llm-client'
import type { TextTranslationDto } from '../api/requests'
@Injectable()
export class TranslationService {
  constructor(private readonly llm: LlmService) {}
  async translate(input: TextTranslationDto) {
    const prompt = `Translate from ${input.sourceLanguage} to ${input.targetLanguage}. Return only the translation. Text: ${input.text}`
    const result = await this.llm.generateText({ system: 'You are a concise Chinese-Korean travel translator.', prompt })
    if (result.provider === 'remote' && result.text) return { source: input.text, translated: result.text, romanization: '', words: [], context: '由已配置的大模型生成' }
    const known: Record<string, { translated: string; romanization: string }> = { '我想去景福宫': { translated: '경복궁에 가고 싶어요.', romanization: 'Gyeongbokgung-e gago sipeoyo.' }, '你好': { translated: '안녕하세요.', romanization: 'Annyeonghaseyo.' } }
    const normalized = input.text.trim().replace(/[。.!！?？]$/, '')
    const fallback = known[normalized] ?? { translated: `[演示翻译] ${input.text}`, romanization: '' }
    return { source: input.text, ...fallback, words: [{ korean: '가고 싶어요', chinese: '想去' }], context: '本地演示结果；配置 LLM 后自动切换真实翻译' }
  }
}
