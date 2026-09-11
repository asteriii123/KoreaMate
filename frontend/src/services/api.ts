import { buildMockPlan, mockTranslation } from '../data'
import type { InspirationItem, TranslationResult, TravelPlan, TravelPreferences } from '../types'

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'
interface ApiResponse<T> { success: boolean; data: T }
async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`${baseUrl}${path}`, { credentials: 'include', headers: { 'content-type': 'application/json', ...init?.headers }, ...init }); const body = await response.json() as ApiResponse<T> & { error?: { message?: string } }; if (!response.ok || !body.success) throw new Error(body.error?.message ?? '请求失败'); return body.data }
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const api = {
  async translate(text: string, sourceLanguage = 'zh-CN', targetLanguage = 'ko-KR'): Promise<TranslationResult> { try { return await request('/translations/text', { method: 'POST', body: JSON.stringify({ text, sourceLanguage, targetLanguage }) }) } catch { await pause(300); return { ...mockTranslation, source: text, context: `${mockTranslation.context} · 后端未连接，当前为本地演示` } } },
  async createPlan(preferences: TravelPreferences): Promise<TravelPlan> { try { const task = await request<{ taskId: string }>('/travel-plans', { method: 'POST', body: JSON.stringify(preferences) }); for (let attempt = 0; attempt < 20; attempt++) { await pause(250); const status = await request<{ stage: string; resultId?: string }>(`/tasks/${task.taskId}`); if (status.stage === 'completed' && status.resultId) return await request<TravelPlan>(`/travel-plans/${status.resultId}`); if (status.stage === 'failed') throw new Error('行程生成失败') } throw new Error('行程生成超时') } catch { await pause(450); return buildMockPlan(preferences) } },
  async inspirations(query = '', platforms = ''): Promise<{ items: InspirationItem[]; degraded: boolean; notice?: string }> { try { return await request(`/inspirations/search?query=${encodeURIComponent(query)}&platforms=${encodeURIComponent(platforms)}`) } catch { return { degraded: true, notice: '后端未连接，启动后端后即可查看攻略灵感。', items: [] } } },
}

