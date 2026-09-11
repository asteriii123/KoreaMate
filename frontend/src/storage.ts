import type { FavoriteItem, HistoryEntry, TravelPlan, TravelPreferences } from './types'
const VERSION = 1
const keys = { favorites: 'koreamate:favorites', history: 'koreamate:history', plan: 'koreamate:plan', draft: 'koreamate:draft' } as const
type Envelope<T> = { version: number; data: T }
function read<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); if (!raw) return fallback; const parsed = JSON.parse(raw) as Envelope<T>; return parsed.version === VERSION ? parsed.data : fallback } catch { return fallback } }
function write<T>(key: string, data: T) { localStorage.setItem(key, JSON.stringify({ version: VERSION, data })) }
export const storage = {
  getFavorites: () => read<FavoriteItem[]>(keys.favorites, []), setFavorites: (data: FavoriteItem[]) => write(keys.favorites, data),
  getHistory: () => read<HistoryEntry[]>(keys.history, []), setHistory: (data: HistoryEntry[]) => write(keys.history, data),
  getPlan: () => read<TravelPlan | null>(keys.plan, null), setPlan: (data: TravelPlan) => write(keys.plan, data),
  getDraft: () => read<TravelPreferences | null>(keys.draft, null), setDraft: (data: TravelPreferences) => write(keys.draft, data),
}
