import type { City, LanguageOption, Place, TravelPlan, TravelPreferences, TranslationResult } from './types'

export const languages: LanguageOption[] = [
  { code: 'zh-CN', label: '中文', nativeLabel: '简体中文' }, { code: 'ko-KR', label: '韩语', nativeLabel: '한국어' }, { code: 'en-US', label: '英语', nativeLabel: 'English' },
]
export const cities: City[] = [
  { id: 'seoul', name: '首尔', englishName: 'Seoul', koreanName: '서울', tagline: '传统与潮流，在一座城相遇', description: '从古老宫殿、韩屋巷弄到充满活力的街区，首尔适合第一次遇见韩国。', image: 'seoul' },
  { id: 'busan', name: '釜山', englishName: 'Busan', koreanName: '부산', tagline: '沿着海风，寻找松弛感', description: '海岸列车、电影街与地道海鲜，把城市假期过成蓝色慢生活。', image: 'busan' },
  { id: 'jeju', name: '济州', englishName: 'Jeju', koreanName: '제주', tagline: '火山、海岸与岛屿日常', description: '适合自驾与自然爱好者，在山海之间感受济州独特的节奏。', image: 'jeju' },
]
export const places: Place[] = [
  { id: 'gyeongbokgung', cityId: 'seoul', name: '景福宫', koreanName: '경복궁', category: '景点', description: '首尔最具代表性的宫殿，适合上午参观并体验韩服。', address: '首尔特别市钟路区社稷路 161', rating: 4.8, price: '约 ¥16', image: 'palace', tags: ['历史', '韩服', '摄影'] },
  { id: 'ikseondong', cityId: 'seoul', name: '益善洞韩屋村', koreanName: '익선동 한옥마을', category: '咖啡', description: '韩屋改造的小店与咖啡馆密集，是散步和拍照的好去处。', address: '首尔特别市钟路区益善洞', rating: 4.6, price: '人均 ¥70', image: 'cafe', tags: ['韩屋', '咖啡', '散步'] },
  { id: 'gwangjang', cityId: 'seoul', name: '广藏市场', koreanName: '광장시장', category: '美食', description: '绿豆煎饼、紫菜包饭与生拌牛肉，一站式品尝韩国街头味道。', address: '首尔特别市钟路区昌庆宫路 88', rating: 4.5, price: '人均 ¥90', image: 'food', tags: ['市场', '小吃', '本地感'] },
  { id: 'haeundae', cityId: 'busan', name: '海云台海水浴场', koreanName: '해운대해수욕장', category: '景点', description: '釜山最知名的海岸线，日落时沿海散步尤其舒服。', address: '釜山广域市海云台区海云台海边路 264', rating: 4.7, price: '免费', image: 'busan', tags: ['海边', '日落', '散步'] },
  { id: 'gamcheon', cityId: 'busan', name: '甘川文化村', koreanName: '감천문화마을', category: '购物', description: '依山而建的彩色村落，有小型展览与独立纪念品店。', address: '釜山广域市沙下区甘内2路 203', rating: 4.4, price: '免费', image: 'village', tags: ['街区', '艺术', '伴手礼'] },
  { id: 'seongsan', cityId: 'jeju', name: '城山日出峰', koreanName: '성산일출봉', category: '景点', description: '济州东部代表性的火山地貌，清晨登顶可看海上日出。', address: '济州特别自治道西归浦市城山邑', rating: 4.8, price: '约 ¥27', image: 'jeju', tags: ['自然', '徒步', '日出'] },
]
export const mockTranslation: TranslationResult = { source: '我想去景福宫。', translated: '경복궁에 가고 싶어요.', romanization: 'Gyeongbokgung-e gago sipeoyo.', words: [{ korean: '경복궁', chinese: '景福宫' }, { korean: '가고 싶어요', chinese: '想去……' }], context: '礼貌、自然的日常表达，适合向朋友或店员说明行程意愿。' }
export function buildMockPlan(p: TravelPreferences): TravelPlan {
  const city = cities.find((item) => item.id === p.cityId) ?? cities[0]
  const dayTemplates = [
    ['初见城市经典', ['宫殿晨光', '在地午餐', '老街漫步']], ['像当地人一样生活', ['社区早餐', '特色街区', '夜景散步']], ['自然与松弛一天', ['慢节奏早晨', '城市绿地', '日落时刻']], ['藏在街角的惊喜', ['独立小店', '市场午餐', '文化空间']], ['留给喜欢的地方', ['自由探索', '伴手礼时间', '告别晚餐']],
  ]
  const days = Array.from({ length: p.days }, (_, index) => ({ day: index + 1, title: dayTemplates[index % dayTemplates.length][0] as string, summary: `${city.name} · ${p.interests.slice(0, 2).join('与') || '经典体验'}`, activities: (dayTemplates[index % dayTemplates.length][1] as string[]).map((title, i) => ({ time: ['09:30', '13:00', '17:30'][i], title, detail: i === 0 ? '避开人流，从一段舒服的步行开始。' : i === 1 ? '预留充足时间，不赶行程。' : '根据天气灵活调整，享受城市夜色。', cost: [80, 150, 60][i] * p.people, transport: i === 0 ? '地铁约 25 分钟' : '步行或公交 15–20 分钟' })) }))
  const food = p.days * p.people * 220, transport = p.days * p.people * 60, tickets = p.days * p.people * 80, shopping = Math.max(0, p.budget - food - transport - tickets)
  return { id: crypto.randomUUID(), title: `${city.name} ${p.days} 日慢游计划`, cityId: city.id, people: p.people, days, budget: { food, transport, tickets, shopping, total: food + transport + tickets + shopping }, createdAt: new Date().toISOString() }
}
