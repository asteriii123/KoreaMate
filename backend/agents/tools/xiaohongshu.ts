import { Injectable } from '@nestjs/common'
import { McpRegistryService } from './mcp-registry'
import type { InspirationItem, InspirationProvider } from './mcp-types'

interface SearchResult { title: string; url: string }

@Injectable()
export class XiaohongshuProvider implements InspirationProvider {
  readonly platform = 'xiaohongshu' as const
  get enabled() { return process.env.XHS_AUTOMATION_ENABLED === 'true' }

  constructor(private readonly mcp: McpRegistryService) {}

  async search(query: string): Promise<InspirationItem[]> {
    const blocks = await this.mcp.callTool('xiaohongshu-automation', 'xiaohongshu_search_notes', { keywords: query.trim() || '韩国旅行攻略', limit: 5 })
    const notes = this.parseSearch(blocks.join('\n')).slice(0, 5)
    const analyses = await Promise.allSettled(notes.slice(0, 3).map((note) => this.mcp.callTool('xiaohongshu-automation', 'xiaohongshu_analyze_note', { url: note.url })))
    return notes.map((note, index) => this.toItem(note, index, index < 3 && analyses[index]?.status === 'fulfilled' ? analyses[index].value.join('\n') : ''))
  }

  private parseSearch(text: string): SearchResult[] {
    const results: SearchResult[] = []
    try {
      const parsed = JSON.parse(text) as { data?: Array<{ title?: string; url?: string }> }
      for (const note of parsed.data ?? []) if (note.title && note.url) results.push({ title: note.title, url: note.url })
      if (results.length) return results
    } catch {
      // Support the formatted text emitted by older upstream versions.
    }
    const pattern = /\d+\.\s*(.+)\r?\n\s*🔗\s*链接:\s*(\S+)/g
    for (const match of text.matchAll(pattern)) results.push({ title: match[1].trim(), url: match[2].trim() })
    return results
  }

  private toItem(note: SearchResult, index: number, analysis: string): InspirationItem {
    const parsed = this.parseAnalysis(analysis)
    const author = parsed.author || analysis.match(/作者:\s*([^\r\n]+)/)?.[1]?.trim() || '小红书用户'
    const summary = parsed.summary || analysis.match(/内容摘要[^\r\n]*\r?\n\s*([^\r\n]+)/)?.[1]?.trim() || analysis.match(/分析总结[^\r\n]*\r?\n\s*([^\r\n]+)/)?.[1]?.trim() || '点击查看笔记详情'
    return { id: `xiaohongshu-${this.hash(note.url)}`, externalId: note.url, platform: 'xiaohongshu', type: 'note', title: note.title, summary: summary.slice(0, 240), authorName: author, sourceUrl: note.url, relatedCityIds: this.relatedCities(`${note.title}${summary}`), relatedPlaceIds: [], fetchedAt: new Date().toISOString(), metrics: index < 3 ? {} : undefined }
  }

  private parseAnalysis(text: string) {
    try {
      const parsed = JSON.parse(text) as { data?: Record<string, unknown> }
      const data = parsed.data ?? {}
      const basic = (data['基础信息'] ?? {}) as Record<string, unknown>
      return { author: typeof basic['作者'] === 'string' ? basic['作者'] : '', summary: [data['内容摘要'], data['内容'], data['分析总结']].find((value) => typeof value === 'string') as string | undefined }
    } catch { return { author: '', summary: '' } }
  }

  private relatedCities(text: string) {
    const cities: string[] = []
    if (/首尔|서울/i.test(text)) cities.push('seoul')
    if (/釜山|부산/i.test(text)) cities.push('busan')
    if (/济州|제주/i.test(text)) cities.push('jeju')
    return cities
  }

  private hash(value: string) {
    let hash = 0
    for (let index = 0; index < value.length; index++) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
    return Math.abs(hash).toString(36)
  }
}
