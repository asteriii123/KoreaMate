/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { places } from '../data'
import { storage } from '../storage'
import type { FavoriteItem, HistoryEntry, Place, TravelPlan } from '../types'

interface AppDataValue { favorites: FavoriteItem[]; favoritePlaces: Place[]; toggleFavorite: (placeId: string) => void; isFavorite: (placeId: string) => boolean; history: HistoryEntry[]; addHistory: (entry: HistoryEntry) => void; plan: TravelPlan | null; savePlan: (plan: TravelPlan) => void }
const AppDataContext = createContext<AppDataValue | null>(null)
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState(storage.getFavorites)
  const [history, setHistory] = useState(storage.getHistory)
  const [plan, setPlan] = useState(storage.getPlan)
  const value = useMemo<AppDataValue>(() => ({
    favorites, favoritePlaces: places.filter((p) => favorites.some((f) => f.placeId === p.id)),
    isFavorite: (id) => favorites.some((f) => f.placeId === id),
    toggleFavorite: (id) => setFavorites((current) => { const next = current.some((f) => f.placeId === id) ? current.filter((f) => f.placeId !== id) : [...current, { placeId: id, savedAt: new Date().toISOString() }]; storage.setFavorites(next); return next }),
    history, addHistory: (entry) => setHistory((current) => { const next = [entry, ...current].slice(0, 30); storage.setHistory(next); return next }),
    plan, savePlan: (next) => { setPlan(next); storage.setPlan(next) },
  }), [favorites, history, plan])
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
export function useAppData() { const value = useContext(AppDataContext); if (!value) throw new Error('useAppData must be used within AppDataProvider'); return value }
