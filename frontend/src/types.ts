export type TranslationMode = 'text' | 'voice' | 'video'
export type VoiceState = 'idle' | 'listening' | 'result'
export interface LanguageOption { code: string; label: string; nativeLabel: string }
export interface TranslationResult { source: string; translated: string; romanization: string; words: { korean: string; chinese: string }[]; context: string }
export interface VideoTaskStep { id: string; label: string; status: 'pending' | 'active' | 'done' }
export type PlaceCategory = '景点' | '美食' | '咖啡' | '购物'
export interface City { id: string; name: string; englishName: string; koreanName: string; tagline: string; description: string; image: string }
export interface Place { id: string; cityId: string; name: string; koreanName: string; category: PlaceCategory; description: string; address: string; rating: number; price: string; image: string; tags: string[] }
export interface TravelPreferences { cityId: string; days: number; people: number; budget: number; interests: string[]; note: string }
export interface Activity { time: string; title: string; placeId?: string; detail: string; cost: number; transport: string }
export interface TravelDay { day: number; title: string; summary: string; activities: Activity[] }
export interface BudgetBreakdown { food: number; transport: number; tickets: number; shopping: number; total: number }
export interface TravelPlan { id: string; title: string; cityId: string; people: number; days: TravelDay[]; references?: { title: string; authorName: string; sourceUrl: string; platform: InspirationPlatform; fetchedAt: string }[]; budget: BudgetBreakdown; createdAt: string }
export interface FavoriteItem { placeId: string; savedAt: string }
export interface HistoryEntry { id: string; type: 'translation' | 'travel'; title: string; detail: string; createdAt: string }
export type InspirationPlatform = 'xiaohongshu' | 'douyin' | 'bilibili' | 'weibo' | 'kstay' | 'web'
export interface InspirationItem { id: string; externalId: string; platform: InspirationPlatform; type: 'note' | 'video' | 'lodging'; title: string; summary: string; authorName: string; sourceUrl: string; publishedAt?: string; metrics?: { likes?: number; comments?: number; favorites?: number; views?: number }; relatedCityIds: string[]; relatedPlaceIds: string[]; fetchedAt: string }
