// 따뜻한 오프화이트 바탕 + 잉크색 카드/버튼. 색은 로또 공과 포인트(골드)에만 쓴다.
export const colors = {
  bg: '#F6F5F2',
  surface: '#FFFFFF',
  ink: '#14161A',
  inkSoft: '#5E6168',
  inkFaint: '#A0A3AA',
  line: '#E8E6E1',
  chip: '#EEECE7',
  gold: '#E7A800',
  goldSoft: '#FFF3CC',
  good: '#10A06A',
  danger: '#E5484D',
  onInk: '#FFFFFF',
  onInkSoft: 'rgba(255,255,255,0.62)',
};

export const font = {
  regular: 'Pretendard-Regular',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
  // 숫자(공, 당첨금)에는 가는 기하학적 서체를 쓴다
  numLight: 'Outfit-Light',
  num: 'Outfit-Medium',
  numBold: 'Outfit-SemiBold',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

// 공 색: 동행복권 구간(1-10 노랑, 11-20 파랑, 21-30 빨강, 31-40 회색, 41-45 초록)을 조금 정돈한 색
export const ballColors = [
  { max: 10, bg: '#F2A900', deep: '#C98800' },
  { max: 20, bg: '#3D97F5', deep: '#2272CE' },
  { max: 30, bg: '#F2605E', deep: '#CF3F3D' },
  { max: 40, bg: '#8C929C', deep: '#6C727C' },
  { max: 45, bg: '#34B873', deep: '#1F9558' },
];

export function ballColor(n) {
  return ballColors.find((c) => n <= c.max) || ballColors[ballColors.length - 1];
}

export const shadow = {
  shadowColor: '#14161A',
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};
