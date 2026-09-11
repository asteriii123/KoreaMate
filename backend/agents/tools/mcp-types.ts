export type McpTransport = 'stdio' | 'streamable-http'
export interface McpProviderConfig { id: string; enabled: boolean; transport: McpTransport; endpoint?: string; command?: string; allowedTools: string[]; timeoutMs: number; maxRetries: number }
export type InspirationPlatform = 'xiaohongshu' | 'douyin' | 'bilibili' | 'weibo' | 'kstay' | 'web'
export interface InspirationItem { id: string; externalId: string; platform: InspirationPlatform; type: 'note' | 'video' | 'lodging'; title: string; summary: string; authorName: string; coverUrl?: string; sourceUrl: string; publishedAt?: string; metrics?: { likes?: number; comments?: number; favorites?: number; views?: number }; relatedCityIds: string[]; relatedPlaceIds: string[]; fetchedAt: string }
export interface InspirationProvider { readonly platform: InspirationPlatform; readonly enabled: boolean; search(query: string): Promise<InspirationItem[]> }
