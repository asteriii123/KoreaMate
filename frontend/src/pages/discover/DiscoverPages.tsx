import { ArrowLeft, Clock3, ExternalLink, Heart, MapPin, Navigation, Search, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { cities, places } from '../../data'
import { EmptyState, PageIntro, PlaceCard, Visual } from '../../components/common'
import { useAppData } from '../../hooks/useAppData'
import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import type { InspirationItem, InspirationPlatform, PlaceCategory } from '../../types'

const categories: ('全部' | PlaceCategory)[] = ['全部', '景点', '美食', '咖啡', '购物']
export function DiscoverPage() {
  const [category, setCategory] = useState<(typeof categories)[number]>('全部'); const filtered = category === '全部' ? places : places.filter((p)=>p.category===category)
  return <div className="shell page"><PageIntro eyebrow="DISCOVER KOREA" title="发现下一次心动的地方" description="从代表性地标到藏在街角的小店，用更舒服的方式认识韩国。"/><div className="city-strip">{cities.map((city)=><Link to={`/discover/${city.id}`} key={city.id}><Visual tone={city.image} label={city.name}/><div><span>{city.koreanName}</span><strong>{city.name}</strong><small>{city.tagline}</small></div></Link>)}</div><div className="filter-row" role="group" aria-label="地点类别">{categories.map((item)=><button className={category===item?'active':''} onClick={()=>setCategory(item)} key={item}>{item}</button>)}</div><div className="places-grid">{filtered.map((p)=><PlaceCard place={p} key={p.id}/>)}</div><InspirationSection/></div>
}

const platformNames: Record<InspirationPlatform, string> = { xiaohongshu: '小红书', douyin: '抖音', bilibili: 'B站', weibo: '微博', kstay: 'K-STAY', web: '网页' }
function InspirationSection() {
  const [items, setItems] = useState<InspirationItem[]>([]); const [platform, setPlatform] = useState<'' | InspirationPlatform>(''); const [query, setQuery] = useState(''); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(true)
  async function load(nextQuery = query, nextPlatform = platform) { setLoading(true); const result = await api.inspirations(nextQuery, nextPlatform); setItems(result.items); setNotice(result.notice ?? ''); setLoading(false) }
  useEffect(() => { void api.inspirations('', '').then((result) => { setItems(result.items); setNotice(result.notice ?? ''); setLoading(false) }) }, [])
  return <section className="section inspiration-section"><div className="section-head"><div><p className="eyebrow">TRAVEL INSPIRATION</p><h2>攻略灵感</h2><p>看看大家最近怎样玩韩国，再把喜欢的地点加入自己的路线。</p></div></div><form className="inspiration-search" onSubmit={(e)=>{e.preventDefault();void load()}}><Search/><label className="sr-only" htmlFor="inspiration-query">搜索攻略</label><input id="inspiration-query" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="搜索首尔咖啡、釜山海岸……"/><button className="button">搜索</button></form><div className="filter-row" role="group" aria-label="攻略平台">{(['','web','xiaohongshu','douyin','bilibili','kstay'] as const).map((value)=><button type="button" className={platform===value?'active':''} onClick={()=>{setPlatform(value);void load(query,value)}} key={value||'all'}>{value?platformNames[value]:'全部'}</button>)}</div>{notice&&<p className="inspiration-notice">{notice}</p>}{loading?<p>正在整理攻略灵感…</p>:items.length?<div className="inspiration-grid">{items.map((item)=><article key={item.id}><div><span className={`platform ${item.platform}`}>{platformNames[item.platform]}</span><small>{item.type==='video'?'视频':item.type==='lodging'?'住宿':'图文'}</small></div><h3>{item.title}</h3><p>{item.summary}</p><footer><span>{item.authorName}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源 <ExternalLink/></a></footer></article>)}</div>:<EmptyState title="暂时没有找到相关攻略" description="换一个城市或关键词试试看。" action="浏览全部地点" to="/discover"/>}</section>
}
export function CityPage() {
  const { cityId } = useParams(); const city = cities.find((c)=>c.id===cityId); if(!city) return <div className="shell page"><EmptyState title="没有找到这座城市" description="我们目前为你准备了首尔、釜山和济州的内容。" action="浏览全部城市" to="/discover"/></div>
  const cityPlaces=places.filter((p)=>p.cityId===city.id)
  return <div className="shell page"><Link className="back" to="/discover"><ArrowLeft/> 返回发现</Link><section className="city-hero"><Visual tone={city.image} label={`${city.name}旅行风景`}/><div><p>{city.koreanName} · {city.englishName}</p><h1>{city.name}</h1><h2>{city.tagline}</h2><span>{city.description}</span></div></section><section className="section"><div className="section-head"><div><p className="eyebrow">CITY PICKS</p><h2>值得加入行程</h2></div><Link to="/travel/planner">用它规划行程</Link></div><div className="places-grid">{cityPlaces.map((p)=><PlaceCard place={p} key={p.id}/>)}</div></section></div>
}
export function PlacePage() {
  const { placeId } = useParams(); const place = places.find((p)=>p.id===placeId); const { isFavorite, toggleFavorite } = useAppData(); if(!place) return <div className="shell page"><EmptyState title="没有找到这个地点" description="它可能已被移除，回到发现页看看其他推荐吧。" action="返回发现" to="/discover"/></div>
  const city=cities.find((c)=>c.id===place.cityId)!
  return <div className="shell page place-detail"><Link className="back" to={`/discover/${city.id}`}><ArrowLeft/> 返回{city.name}</Link><div className="detail-grid"><Visual tone={place.image} label={place.name}/><article><span className="pill">{place.category}</span><h1>{place.name}</h1><h2 lang="ko">{place.koreanName}</h2><div className="detail-rating"><Star fill="currentColor"/> {place.rating} · {place.price}</div><p>{place.description}</p><div className="detail-info"><div><MapPin/><span><small>地址</small>{place.address}</span></div><div><Clock3/><span><small>建议停留</small>约 1.5–2 小时</span></div></div><div className="tags">{place.tags.map((tag)=><span key={tag}>{tag}</span>)}</div><div className="detail-actions"><button className="button" onClick={()=>toggleFavorite(place.id)}><Heart fill={isFavorite(place.id)?'currentColor':'none'}/>{isFavorite(place.id)?'已收藏':'收藏地点'}</button><button className="secondary"><Navigation/> 查看路线（模拟）</button></div></article></div></div>
}
