export type PoppleEvent = {
  id: string
  title: string
  date: string
  location: string
  price: string
  imageUrl: string
  tags: string[]
  // 하위 호환성을 위한 선택적 필드
  category?: string
  poster?: string
  description?: string
  websiteUrl?: string
  operatingHours?: string
  startDate?: string
  endDate?: string
  viewCount?: number
}

export const MOCK_EVENTS: PoppleEvent[] = [
  {
    id: "event_home_01",
    title: "블루밍 뮤직 페스티벌",
    date: "2026. 05. 24(토) - 05. 25(일)",
    location: "서울 송파구 올림픽로 25 (잠실종합운동장)",
    price: "1일권 88,000원 / 2일권 154,000원",
    imageUrl: "/events/rock-festival.png",
    poster: "/events/rock-festival.png",
    tags: ["뮤직페스티벌", "잠실", "라이브", "콘서트", "봄축제"],
    category: "뮤직/페스티벌",
    description: "화려한 무대와 감미로운 라이브 사운드가 어우러진 봄날의 음악 축제. 국내외 최정상 아티스트들이 선사하는 뜨거운 열기를 즐겨보세요.",
  },
  {
    id: "event_home_02",
    title: "서울 재즈 & 피크닉 페스타",
    date: "2026. 05. 30(금) - 06. 01(일)",
    location: "서울 마포구 한강난지로 162 (난지한강공원)",
    price: "입장 무료 (피크닉존 예약제)",
    imageUrl: "/events/jazz-picnic.png",
    poster: "/events/jazz-picnic.png",
    tags: ["재즈페스타", "한강피크닉", "가을감성", "라이브공연", "야외페스티벌"],
    category: "재즈/피크닉",
    description: "푸른 잔디밭에서 울려 퍼지는 감미로운 재즈 선율. 시원한 강바람과 함께 여유로운 주말 피크닉을 즐겨보세요.",
  },
  {
    id: "event_home_03",
    title: "컬러풀 모먼츠 팝업",
    date: "2026. 10. 01(수) - 10. 19(일)",
    location: "성수 무신사 스퀘어",
    price: "무료",
    imageUrl: "/events/media-art.png",
    poster: "/events/media-art.png",
    tags: ["팝업", "성수", "전시체험", "사진명소", "가을감성"],
    category: "팝업",
    description: "가을밤을 환하게 밝히는 빛과 예술의 팝업스토어. 감각적인 전시부터 포토존까지 다채로운 프로그램을 만나보세요.",
    operatingHours: "11:00 ~ 20:00",
  },
  {
    id: "event_home_04",
    title: "감각적인 전시 '취향 발견'",
    date: "2026. 05. 01(금) - 06. 30(화)",
    location: "서울 종로구 율곡로 3길 (아라리오 뮤지엄)",
    price: "성인 12,000원 / 청소년 8,000원",
    imageUrl: "/events/media-art.png",
    poster: "/events/media-art.png",
    tags: ["실내데이트", "아트", "현대미술", "전시회", "인생샷"],
    category: "전시/아트",
    description: "현대 미술 작가들의 독창적인 시선과 미학을 엿볼 수 있는 몰입형 전시. 나만의 감성과 취향을 발견해보세요.",
  },
  {
    id: "event_home_05",
    title: "햇살 충전 '주말 나들이 꽃축제'",
    date: "2026. 05. 10(일) - 05. 31(일)",
    location: "서울 성동구 뚝섬로 273 (서울숲 공원 일대)",
    price: "입장 무료",
    imageUrl: "/events/flower-festival.png",
    poster: "/events/flower-festival.png",
    tags: ["봄축제", "피크닉", "튤립축제", "가족나들이", "산책코스"],
    category: "야외/축제",
    description: "알록달록 만개한 튤립과 꽃내음이 가득한 서울숲. 따스한 봄 햇살 아래 돗자리를 펴고 즐기는 최고의 주말 나들이.",
  },
]

export const EVENTS = MOCK_EVENTS

export function getEventById(id: string): PoppleEvent | undefined {
  return MOCK_EVENTS.find((event) => event.id === id)
}
