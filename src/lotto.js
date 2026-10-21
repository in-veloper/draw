import AsyncStorage from '@react-native-async-storage/async-storage';

// 회차 데이터: 동행복권 공식 조회(최신 회차 확인용)와 GitHub Pages 에 올라온 전 회차 미러를 같이 쓴다.
// 공식 주소는 브라우저(웹 미리보기)에서는 막혀서, 그럴 땐 미러만으로 동작한다.
const MIRROR = 'https://smok95.github.io/lotto/results';
const OFFICIAL = 'https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=';
const KEY = 'draw/draws/v1';

const WEEK = 7 * 24 * 3600 * 1000;
// 1회 추첨: 2002-12-07(토) 20:35 KST → UTC 11:35
const FIRST_DRAW = Date.UTC(2002, 11, 7, 11, 35);

export const PRICE = 1000;

// 지금 시각 기준으로 "이미 추첨이 끝났어야 하는" 마지막 회차(추첨 후 약 30분 뒤부터)
export function expectedLatest(now = Date.now()) {
  return Math.floor((now - FIRST_DRAW - 30 * 60 * 1000) / WEEK) + 1;
}

// n회 추첨 시각(ms)
export function drawTime(n) {
  return FIRST_DRAW + (n - 1) * WEEK;
}

export function ymd(ms) {
  const d = new Date(ms + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

function fromMirror(d) {
  const div = d.divisions || [];
  return {
    n: d.draw_no,
    date: d.date.slice(0, 10).replace(/-/g, '.'),
    nums: d.numbers,
    bonus: d.bonus_no,
    prizes: [0, 1, 2, 3, 4].map((i) => div[i]?.prize || 0),
    winners: [0, 1, 2, 3, 4].map((i) => div[i]?.winners || 0),
    sales: d.total_sales_amount || 0,
  };
}

function fromOfficial(it) {
  const y = String(it.ltRflYmd);
  return {
    n: it.ltEpsd,
    date: `${y.slice(0, 4)}.${y.slice(4, 6)}.${y.slice(6, 8)}`,
    nums: [it.tm1WnNo, it.tm2WnNo, it.tm3WnNo, it.tm4WnNo, it.tm5WnNo, it.tm6WnNo],
    bonus: it.bnsWnNo,
    prizes: [it.rnk1WnAmt, it.rnk2WnAmt, it.rnk3WnAmt, it.rnk4WnAmt, it.rnk5WnAmt].map((v) => v || 0),
    winners: [it.rnk1WnNope, it.rnk2WnNope, it.rnk3WnNope, it.rnk4WnNope, it.rnk5WnNope].map((v) => v || 0),
    sales: it.wholEpsdSumNtslAmt || 0,
  };
}

async function getJson(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchOfficial(n) {
  const j = await getJson(`${OFFICIAL}${n}`, 8000);
  const it = j?.data?.list?.[0];
  return it && it.ltEpsd === n ? fromOfficial(it) : null;
}

export async function loadCached() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(draws) {
  AsyncStorage.setItem(KEY, JSON.stringify(draws)).catch(() => {});
}

// 캐시에 없는 회차만 받아서 합친다. 처음이면 전 회차를 한 번에 받는다.
export async function refreshDraws(cached) {
  let draws = [...cached].sort((a, b) => a.n - b.n);
  const have = draws.length ? draws[draws.length - 1].n : 0;

  let latest = 0;
  try {
    latest = (await getJson(`${MIRROR}/latest.json`)).draw_no;
  } catch {
    latest = have;
  }

  // 미러가 늦으면 공식 조회로 방금 끝난 회차를 직접 확인한다
  const expected = expectedLatest();
  let official = null;
  if (expected > latest) {
    try {
      official = await fetchOfficial(expected);
      if (official) latest = expected;
    } catch {
      // 공식 주소가 막혀 있으면(웹 미리보기) 미러 기준으로 간다
    }
  }

  if (!draws.length) {
    try {
      const all = await getJson(`${MIRROR}/all.json`, 30000);
      draws = all.map(fromMirror);
    } catch {
      // 전체를 못 받으면 최근 회차만이라도
    }
  }

  const known = new Set(draws.map((d) => d.n));
  const missing = [];
  for (let n = Math.max(1, (draws.length ? draws[draws.length - 1].n : latest - 30) + 1); n <= latest; n += 1) {
    if (!known.has(n)) missing.push(n);
  }
  for (const n of missing.slice(-40)) {
    if (official && official.n === n) {
      draws.push(official);
      continue;
    }
    try {
      draws.push(fromMirror(await getJson(`${MIRROR}/${n}.json`)));
    } catch {
      try {
        const o = await fetchOfficial(n);
        if (o) draws.push(o);
      } catch {
        // 이 회차는 다음에 다시 시도
      }
    }
  }

  draws.sort((a, b) => a.n - b.n);
  if (draws.length) save(draws);
  return draws;
}

// ───────── 당첨 판정 ─────────

// rank: 1~5, 0 이면 낙첨
export function evaluate(nums, draw) {
  const win = new Set(draw.nums);
  const hits = nums.filter((x) => win.has(x));
  const bonusHit = nums.includes(draw.bonus);
  let rank = 0;
  if (hits.length === 6) rank = 1;
  else if (hits.length === 5 && bonusHit) rank = 2;
  else if (hits.length === 5) rank = 3;
  else if (hits.length === 4) rank = 4;
  else if (hits.length === 3) rank = 5;
  return { rank, hits, bonusHit };
}

export function prizeOf(rank, draw) {
  if (!rank) return 0;
  return draw.prizes[rank - 1] || 0;
}

// ───────── 표시용 ─────────

export function won(n) {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

// 18억 8,102만원 처럼 읽기 쉽게
export function wonShort(n) {
  if (!n) return '0원';
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  // 공백 자리에서 줄이 바뀌지 않도록 줄바꿈 없는 공백(NBSP)을 쓴다
  if (eok && man) return `${eok}억 ${man.toLocaleString('ko-KR')}만원`;
  if (eok) return `${eok}억원`;
  if (man) return `${man.toLocaleString('ko-KR')}만원`;
  return won(n);
}
