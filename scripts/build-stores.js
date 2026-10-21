// 동행복권 "당첨판매점" 조회를 전 회차 돌면서 판매점별 1·2등 배출 횟수를 모아 assets/stores.json 으로 만든다.
// (일반 판매점 검색은 막혀 있어서, "당첨 이력이 있는 판매점"이 앱의 판매점 목록이 된다.)
// 사용: node scripts/build-stores.js [마지막회차]
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'stores.json');
const HEADERS = {
  AJAX: 'true',
  requestMenuUri: '/wnprchsplcsrch/home',
  Referer: 'https://www.dhlottery.co.kr/wnprchsplcsrch/home',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'User-Agent': 'Mozilla/5.0',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return await res.json();
    } catch {
      // 다시 시도
    }
    await sleep(500 * (i + 1));
  }
  throw new Error(`failed: ${url}`);
}

async function latestRound() {
  const j = await getJson('https://smok95.github.io/lotto/results/latest.json');
  return j.draw_no;
}

(async () => {
  const last = Number(process.argv[2]) || (await latestRound());
  const stores = new Map();
  let first = null;

  for (let round = 1; round <= last; round += 1) {
    const j = await getJson(
      `https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=all&srchLtEpsd=${round}`
    );
    const list = j?.data?.list || [];
    if (list.length && first === null) first = round;

    for (const it of list) {
      if (!it.ltShpId || !it.shpLat || !it.shpLot) continue;
      let s = stores.get(it.ltShpId);
      if (!s) {
        s = {
          id: it.ltShpId,
          name: (it.shpNm || it.tradNm || '').trim(),
          addr: (it.shpAddr || '').replace(/\s+/g, ' ').trim(),
          tel: it.shpTelno && it.shpTelno !== 'null' ? it.shpTelno : '',
          lat: it.shpLat,
          lng: it.shpLot,
          open: it.status === '정상',
          c1: 0,
          c2: 0,
          l1: 0,
          l2: 0,
        };
        stores.set(it.ltShpId, s);
      }
      // 같은 판매점이 나중 회차에 주소·전화를 갱신했을 수 있으니 가장 최근 값을 쓴다
      s.name = (it.shpNm || it.tradNm || s.name).trim();
      s.addr = (it.shpAddr || s.addr).replace(/\s+/g, ' ').trim();
      if (it.shpTelno && it.shpTelno !== 'null') s.tel = it.shpTelno;
      s.open = it.status === '정상';
      if (it.wnShpRnk === 1) {
        s.c1 += 1;
        s.l1 = Math.max(s.l1, round);
      } else if (it.wnShpRnk === 2) {
        s.c2 += 1;
        s.l2 = Math.max(s.l2, round);
      }
    }

    if (round % 100 === 0) console.log(`${round}/${last} · 판매점 ${stores.size}곳`);
    await sleep(120);
  }

  const rows = [...stores.values()]
    .filter((s) => s.open && s.addr.trim())
    .map((s) => [Number(s.id), s.name, s.addr, s.tel, +s.lat.toFixed(6), +s.lng.toFixed(6), s.c1, s.c2, s.l1, s.l2]);

  fs.writeFileSync(OUT, JSON.stringify({ round: last, firstRound: first, stores: rows }));
  console.log(`완료: ${rows.length}곳 (영업 중), 회차 ${first}~${last}, ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
})();
