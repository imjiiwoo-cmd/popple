/**
 * 실시간 방문 후기 포토 피드 데이터 모델 및 고품질 Mock Seed 데이터
 * 백엔드 지연 없이 0.05초 만에 홈 화면에 즉시 렌더링되며,
 * 추후 Supabase DB (reviews 테이블)와 1:1 매핑 연동 가능한 구조입니다.
 */

export interface Review {
  id: string
  author: string
  avatar: string
  eventTitle: string
  eventId?: string
  tag: string
  rating: number // 4.5 ~ 5.0
  content: string
  imageUrl: string
  likes: number
  commentsCount: number
  createdAt: string // "방금 전", "23분 전", "1시간 전" 등 상대 시간
  likedByUser?: boolean
}

export const REAL_REVIEWS_SEED: Review[] = [
  {
    id: 'rev_01',
    author: '성수동산책러',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    eventTitle: '디올 성수 2026 어텀 가든',
    eventId: 'popup_preset_01',
    tag: '#성수팝업',
    rating: 5.0,
    content: '주말 현장 예약 팁 공유해요! 11시 오픈런 추천합니다 📸 정원 포토존 채광이 환상적이에요.',
    imageUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=600&q=80',
    likes: 142,
    commentsCount: 23,
    createdAt: '방금 전',
  },
  {
    id: 'rev_02',
    author: '달빛나들이',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
    eventTitle: '경복궁 가을 야간특별관람',
    eventId: 'fest_preset_01',
    tag: '#경복궁야경',
    rating: 4.9,
    content: '근정전과 경회루 달빛 조명이 예술입니다. 한복 입고 방문하면 현장 무료입장 꿀팁!',
    imageUrl: 'https://images.unsplash.com/photo-1548115184-bc6544d06a58?auto=format&fit=crop&w=600&q=80',
    likes: 98,
    commentsCount: 17,
    createdAt: '23분 전',
  },
  {
    id: 'rev_03',
    author: '루피덕후',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80',
    eventTitle: '잔망루피 마법연구소 팝업',
    eventId: 'popup_preset_03',
    tag: '#성수팝업',
    rating: 4.8,
    content: '대기 30분 만에 입장 성공! 마녀 모자 쓴 한정판 봉제인형 실물이 너무 귀여워요 ㅠㅠ',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
    likes: 115,
    commentsCount: 31,
    createdAt: '1시간 전',
  },
  {
    id: 'rev_04',
    author: '수원시민김씨',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    eventTitle: '수원화성 미디어아트 & 가을 문화제',
    eventId: 'fest_preset_06',
    tag: '#수원야시장',
    rating: 5.0,
    content: '성벽에 쏘는 초대형 레이저 쇼 스케일 미쳤어요! 선선한 가을밤 산책 데이트 코스로 최고.',
    imageUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80',
    likes: 87,
    commentsCount: 14,
    createdAt: '2시간 전',
  },
  {
    id: 'rev_05',
    author: '향수컬렉터',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    eventTitle: "탬버린즈 '이브닝 글로우' 팝업",
    eventId: 'popup_preset_04',
    tag: '#성수핫플',
    rating: 4.7,
    content: '신상 향수 시향존 장미향 가득해서 힐링 그 자체.. 조각상 오브제 포토존 맛집 인정합니다.',
    imageUrl: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80',
    likes: 76,
    commentsCount: 9,
    createdAt: '3시간 전',
  },
  {
    id: 'rev_06',
    author: '억새소풍러',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    eventTitle: '하늘공원 은빛 억새 페스티벌',
    eventId: 'fest_preset_04',
    tag: '#하늘공원',
    rating: 4.9,
    content: '노을 질 때 억새밭 인생샷 건졌어요! 맹꽁이차 줄 길어서 걸어 올라갔는데 산책로 예뻐요.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    likes: 134,
    commentsCount: 28,
    createdAt: '5시간 전',
  },
]
