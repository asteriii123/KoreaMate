import { ArrowRight, Heart, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Place } from '../types'
import { useAppData } from '../hooks/useAppData'

export function PageIntro({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) { return <header className="page-intro">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p>{description}</p></header> }
export function EmptyState({ title, description, action, to }: { title: string; description: string; action: string; to: string }) { return <section className="empty"><div className="empty-mark" aria-hidden="true">K</div><h2>{title}</h2><p>{description}</p><Link className="button" to={to}>{action}<ArrowRight size={18}/></Link></section> }
export function Visual({ tone, label }: { tone: string; label: string }) { return <div className={`visual visual-${tone}`} role="img" aria-label={label}><span>{label}</span></div> }
export function PlaceCard({ place }: { place: Place }) {
  const { isFavorite, toggleFavorite } = useAppData()
  return <article className="place-card"><Link to={`/discover/place/${place.id}`}><Visual tone={place.image} label={place.name}/><div className="place-body"><div><span className="pill">{place.category}</span><span className="rating">★ {place.rating}</span></div><h3>{place.name} <small>{place.koreanName}</small></h3><p>{place.description}</p><span className="meta"><MapPin size={15}/> {place.address}</span></div></Link><button className={`heart ${isFavorite(place.id) ? 'active' : ''}`} aria-label={isFavorite(place.id) ? `取消收藏${place.name}` : `收藏${place.name}`} onClick={() => toggleFavorite(place.id)}><Heart size={19} fill={isFavorite(place.id) ? 'currentColor' : 'none'}/></button></article>
}
