export interface CityRecord { id: string; name: string; englishName: string; koreanName: string; tagline: string; description: string; image: string }
export interface PlaceRecord { id: string; cityId: string; name: string; koreanName: string; category: string; description: string; address: string; rating: number; price: string; image: string; tags: string[] }
export const cities: CityRecord[] = [
  { id: 'seoul', name: '首尔', englishName: 'Seoul', koreanName: '서울', tagline: '传统与潮流并行', description: '从宫殿、市场到设计街区，适合第一次认识韩国。', image: '/images/seoul.webp' },
  { id: 'busan', name: '釜山', englishName: 'Busan', koreanName: '부산', tagline: '山海之间的港口日常', description: '海岸列车、海鲜市场与山城街巷构成轻松路线。', image: '/images/busan.webp' },
  { id: 'jeju', name: '济州', englishName: 'Jeju', koreanName: '제주', tagline: '火山岛上的慢旅行', description: '自然步道、海岸公路与在地风味适合深度度假。', image: '/images/jeju.webp' },
]
export const places: PlaceRecord[] = [
  { id: 'gyeongbokgung', cityId: 'seoul', name: '景福宫', koreanName: '경복궁', category: '景点', description: '首尔代表性的朝鲜王朝宫殿。', address: '首尔钟路区社稷路161', rating: 4.8, price: '₩3,000', image: '/images/gyeongbokgung.webp', tags: ['历史', '拍照'] },
  { id: 'seongsu', cityId: 'seoul', name: '圣水洞', koreanName: '성수동', category: '咖啡', description: '由旧工厂演化出的咖啡与设计街区。', address: '首尔城东区圣水洞', rating: 4.7, price: '人均 ₩15,000', image: '/images/seongsu.webp', tags: ['咖啡', '潮流'] },
  { id: 'haeundae', cityId: 'busan', name: '海云台', koreanName: '해운대', category: '景点', description: '釜山最具代表性的海岸区域。', address: '釜山海云台区', rating: 4.7, price: '免费', image: '/images/haeundae.webp', tags: ['海边', '散步'] },
  { id: 'seongsan', cityId: 'jeju', name: '城山日出峰', koreanName: '성산일출봉', category: '景点', description: '济州东部的火山凝灰岩地貌。', address: '济州特别自治道西归浦市', rating: 4.8, price: '₩5,000', image: '/images/seongsan.webp', tags: ['自然', '徒步'] },
]

