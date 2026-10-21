import data from '../assets/stores.json';

// 판매점 목록: 동행복권 "당첨판매점" 조회를 전 회차 모은 데이터(영업 중인 곳만).
// 일반 판매점 검색은 공식 쪽에서 막혀 있어서, 1·2등 배출 이력이 있는 판매점이 목록이 된다.
let rows = data.stores
  .filter((r) => !String(r[1]).includes('인터넷'))
  .map((r) => ({ id: r[0], name: r[1], addr: r[2], tel: r[3], lat: r[4], lng: r[5], c1: r[6], c2: r[7], l1: r[8], l2: r[9] }));

let byId = new Map(rows.map((r) => [r.id, r]));
let datasetRound = data.round;

export function shopCount() {
  return rows.length;
}

export function shopRound() {
  return datasetRound;
}

export function getShop(id) {
  return byId.get(id) || null;
}

// 두 좌표 사이 거리(km)
export function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function fmtDist(km) {
  return km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)}m` : `${km.toFixed(1)}km`;
}

// 기준점 주변 판매점. 가까운 곳이 너무 적으면 반경을 넓혀서 목록이 비지 않게 한다.
export function nearby(lat, lng, { limit = 60, onlyFirst = false, refLat = lat, refLng = lng } = {}) {
  const radii = [2, 4, 8, 16, 40];
  let found = [];
  for (const r of radii) {
    found = [];
    for (const s of rows) {
      if (onlyFirst && !s.c1) continue;
      if (Math.abs(s.lat - lat) > r / 111 || Math.abs(s.lng - lng) > r / 88) continue;
      const d = distKm(lat, lng, s.lat, s.lng);
      if (d <= r) found.push(s);
    }
    if (found.length >= 12) break;
  }
  return found
    .map((s) => ({ ...s, dist: distKm(refLat, refLng, s.lat, s.lng), centerDist: distKm(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.centerDist - b.centerDist)
    .slice(0, limit);
}

// 번들 데이터 이후에 새로 나온 회차의 당첨 판매점을 받아 횟수에 더한다(공식 조회가 되는 기기에서만).
const HEADERS = {
  AJAX: 'true',
  requestMenuUri: '/wnprchsplcsrch/home',
  Accept: 'application/json, text/javascript, */*; q=0.01',
};

export async function topUp(latestRound) {
  if (latestRound <= datasetRound) return 0;
  let added = 0;
  for (let n = datasetRound + 1; n <= latestRound && n <= datasetRound + 30; n += 1) {
    let list;
    try {
      const res = await fetch(`https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=all&srchLtEpsd=${n}`, { headers: HEADERS });
      const j = await res.json();
      list = j?.data?.list;
    } catch {
      return added;
    }
    if (!list) return added;
    for (const it of list) {
      if (!it.ltShpId || !it.shpLat || !it.shpLot || it.status !== '정상') continue;
      const id = Number(it.ltShpId);
      let s = byId.get(id);
      if (!s) {
        s = {
          id,
          name: (it.shpNm || '').trim(),
          addr: (it.shpAddr || '').replace(/\s+/g, ' ').trim(),
          tel: it.shpTelno && it.shpTelno !== 'null' ? it.shpTelno : '',
          lat: it.shpLat,
          lng: it.shpLot,
          c1: 0,
          c2: 0,
          l1: 0,
          l2: 0,
        };
        byId.set(id, s);
        rows.push(s);
      }
      if (it.wnShpRnk === 1) {
        s.c1 += 1;
        s.l1 = n;
      } else if (it.wnShpRnk === 2) {
        s.c2 += 1;
        s.l2 = n;
      }
      added += 1;
    }
    datasetRound = n;
  }
  return added;
}

// ───────── 지역별 1등 판매점 ─────────

// "서울 중구 퇴계로 222-1" → { sido: '서울', city: '중구' }
export function regionOf(addr) {
  const t = String(addr || '').trim().split(/\s+/);
  return { sido: t[0] || '', city: t[1] || '' };
}

// 내 위치에서 가장 가까운 판매점의 주소를 빌려 "내가 있는 시·군·구"를 알아낸다(별도 주소 변환 서비스 없이)
export function regionAt(lat, lng) {
  let best = null;
  let bestD = 1e9;
  for (const s of rows) {
    if (Math.abs(s.lat - lat) > 0.2 || Math.abs(s.lng - lng) > 0.25) continue;
    const d = distKm(lat, lng, s.lat, s.lng);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best && bestD < 15 ? regionOf(best.addr) : null;
}

const winCache = new Map();

// n회 1등 판매점. 공식 조회가 되면 그걸로, 안 되면(웹 미리보기·오프라인) 번들 데이터에서 그 회차가 "마지막 1등"인 곳만.
export async function firstPlaceShops(n) {
  if (winCache.has(n)) return winCache.get(n);
  let list = null;
  try {
    const res = await fetch(`https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=1&srchLtEpsd=${n}`, { headers: HEADERS });
    const j = await res.json();
    if (Array.isArray(j?.data?.list)) {
      list = j.data.list
        .filter((it) => it.shpLat && it.shpLot && !String(it.shpNm).includes('인터넷'))
        .map((it) => ({
          id: Number(it.ltShpId),
          name: (it.shpNm || '').trim(),
          addr: (it.shpAddr || '').replace(/\s+/g, ' ').trim(),
          tel: it.shpTelno && it.shpTelno !== 'null' ? it.shpTelno : '',
          lat: it.shpLat,
          lng: it.shpLot,
          type: it.atmtPsvYnTxt || '',
        }));
    }
  } catch {
    list = null;
  }
  if (!list) {
    list = rows.filter((s) => s.l1 === n).map((s) => ({ id: s.id, name: s.name, addr: s.addr, tel: s.tel, lat: s.lat, lng: s.lng, type: '' }));
  }
  winCache.set(n, list);
  return list;
}
