import { Injectable } from '@nestjs/common'
export interface FavoriteRecord { id: string; visitorId: string; targetType: 'place' | 'travel_plan' | 'inspiration'; targetId: string; savedAt: string }
@Injectable()
export class FavoritesService { private readonly items: FavoriteRecord[] = []; list(visitorId: string) { return this.items.filter((x) => x.visitorId === visitorId) } add(visitorId: string, targetType: FavoriteRecord['targetType'], targetId: string) { const old = this.items.find((x) => x.visitorId === visitorId && x.targetType === targetType && x.targetId === targetId); if (old) return old; const item = { id: crypto.randomUUID(), visitorId, targetType, targetId, savedAt: new Date().toISOString() }; this.items.push(item); return item } remove(visitorId: string, id: string) { const index = this.items.findIndex((x) => x.id === id && x.visitorId === visitorId); if (index >= 0) this.items.splice(index, 1); return { removed: index >= 0 } } }

