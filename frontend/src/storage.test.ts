import './test/setup'
import { describe, expect, it } from 'vitest'
import { storage } from './storage'

describe('versioned storage', () => {
  it('round trips favorites', () => { storage.setFavorites([{ placeId: 'gyeongbokgung', savedAt: '2026-01-01' }]); expect(storage.getFavorites()).toHaveLength(1) })
  it('recovers from malformed data', () => { localStorage.setItem('koreamate:favorites', '{bad'); expect(storage.getFavorites()).toEqual([]) })
  it('ignores unknown schema versions', () => { localStorage.setItem('koreamate:favorites', JSON.stringify({ version: 99, data: [{ placeId: 'x' }] })); expect(storage.getFavorites()).toEqual([]) })
})
