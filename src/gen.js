// 번호 뽑기. 모드는 둘이다.
//  · random  : 완전 무작위(1~45 에서 중복 없이 균등하게)
//  · stats   : 최근 N회 당첨 번호의 출현 횟수로 가중치를 주고, 역대 당첨 조합의 전형적인 균형(합계·홀짝·고저·연번)을
//              벗어나는 조합은 버린다. "자주 나온 번호"(hot) 또는 "오래 안 나온 번호"(cold) 쪽으로 기울일 수 있다.
// 로또는 매 회차가 독립이라 어떤 방법도 당첨 확률을 바꾸진 못한다 — 통계 모드는 취향에 맞는 번호를 고르는 도구다.

export const ALL = Array.from({ length: 45 }, (_, i) => i + 1);

function rand(n, rng = Math.random) {
  return Math.floor(rng() * n);
}

// 같은 글자(날짜 등)로는 늘 같은 번호가 나오게 하는 난수(mulberry32)
export function seeded(text) {
  let h = 1779033703;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 가중치 비례로 중복 없이 k개 뽑기
function weightedPick(k, weights, taken, rng = Math.random) {
  const pool = ALL.filter((x) => !taken.includes(x));
  const out = [];
  for (let i = 0; i < k && pool.length; i += 1) {
    const total = pool.reduce((a, x) => a + weights[x], 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx += 1) {
      r -= weights[pool[idx]];
      if (r <= 0) break;
    }
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

// 최근 range 회의 출현 횟수와 "안 나온 지 얼마나 됐는지"
export function statsOf(draws, range) {
  const recent = draws.slice(-range);
  const freq = Array(46).fill(0);
  const gap = Array(46).fill(recent.length);
  recent.forEach((d, i) => {
    d.nums.forEach((x) => {
      freq[x] += 1;
      gap[x] = Math.min(gap[x], recent.length - 1 - i);
    });
  });
  return { freq, gap, count: recent.length };
}

function balanced(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const odd = sorted.filter((x) => x % 2).length;
  const low = sorted.filter((x) => x <= 22).length;
  let run = 1;
  let maxRun = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  return sum >= 100 && sum <= 175 && odd >= 2 && odd <= 4 && low >= 2 && low <= 4 && maxRun <= 2;
}

function weightsFor(stat, lean) {
  const w = Array(46).fill(1);
  const mean = stat.freq.slice(1).reduce((a, b) => a + b, 0) / 45 || 1;
  for (let x = 1; x <= 45; x += 1) {
    if (lean === 'cold') {
      // 오래 쉰 번호일수록 크게
      w[x] = 1 + stat.gap[x] / Math.max(1, stat.count / 6);
    } else {
      // 평균보다 많이 나온 번호일수록 크게(음수가 되지 않게 바닥을 둔다)
      w[x] = Math.max(0.35, 1 + (stat.freq[x] - mean) / Math.max(1, mean * 0.6));
    }
  }
  return w;
}

// fixed: 반자동에서 사용자가 고른 번호. 나머지를 채워 6개를 돌려준다(오름차순).
export function makeGame({ fixed = [], mode = 'random', draws = [], range = 100, lean = 'hot', rng = Math.random }) {
  const need = 6 - fixed.length;
  if (need <= 0) return [...fixed].sort((a, b) => a - b).slice(0, 6);

  if (mode === 'stats' && draws.length >= 10) {
    const w = weightsFor(statsOf(draws, range), lean);
    let best = null;
    for (let i = 0; i < 300; i += 1) {
      const game = [...fixed, ...weightedPick(need, w, fixed, rng)];
      if (!best) best = game;
      if (balanced(game)) return game.sort((a, b) => a - b);
    }
    return best.sort((a, b) => a - b);
  }

  const pool = ALL.filter((x) => !fixed.includes(x));
  const out = [];
  for (let i = 0; i < need; i += 1) out.push(pool.splice(rand(pool.length, rng), 1)[0]);
  return [...fixed, ...out].sort((a, b) => a - b);
}

export function describe(nums) {
  const odd = nums.filter((x) => x % 2).length;
  const sum = nums.reduce((a, b) => a + b, 0);
  return `홀${odd} 짝${6 - odd} · 합 ${sum}`;
}
