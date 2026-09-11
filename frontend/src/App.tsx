import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { AppDataProvider } from './hooks/useAppData'
import HomePage from './pages/HomePage'
import TranslationPage from './pages/translation/TranslationPage'
import { TravelHome, TravelPlanner, TravelResult } from './pages/travel/TravelPages'
import { CityPage, DiscoverPage, PlacePage } from './pages/discover/DiscoverPages'
import { FavoritesPage, HistoryPage, ProfilePage, SettingsPage } from './pages/profile/ProfilePages'
import NotFoundPage from './pages/NotFoundPage'

export default function App() { return <AppDataProvider><Routes><Route element={<Layout/>}><Route index element={<HomePage/>}/><Route path="translate" element={<TranslationPage/>}/><Route path="travel" element={<TravelHome/>}/><Route path="travel/planner" element={<TravelPlanner/>}/><Route path="travel/result" element={<TravelResult/>}/><Route path="discover" element={<DiscoverPage/>}/><Route path="discover/:cityId" element={<CityPage/>}/><Route path="discover/place/:placeId" element={<PlacePage/>}/><Route path="profile" element={<ProfilePage/>}/><Route path="profile/history" element={<HistoryPage/>}/><Route path="profile/favorites" element={<FavoritesPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="*" element={<NotFoundPage/>}/></Route></Routes></AppDataProvider> }
