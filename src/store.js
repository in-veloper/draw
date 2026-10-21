import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { expectedLatest, loadCached, refreshDraws } from './lotto';

const KEY = 'draw/tickets/v1';

// state.draws: 오름차순 회차 목록 / state.tickets: 저장한 번호(게임) 목록
let state = { loaded: false, loading: false, failed: false, draws: [], tickets: [] };
const listeners = new Set();

export function useStore() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
}

function emit(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(state.tickets)).catch(() => {});
}

export async function init() {
  let tickets = [];
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) tickets = JSON.parse(raw);
  } catch {
    tickets = [];
  }
  const draws = await loadCached();
  emit({ loaded: true, tickets, draws });
  refresh();
}

// 새 회차가 나왔는지 확인해서 받아온다. 네트워크가 없으면 있던 데이터로 계속 간다.
export async function refresh() {
  if (state.loading) return;
  emit({ loading: true });
  try {
    const draws = await refreshDraws(state.draws);
    emit({ draws: draws.length ? draws : state.draws, failed: !draws.length && !state.draws.length, loading: false });
  } catch {
    emit({ failed: !state.draws.length, loading: false });
  }
}

export function latestDraw() {
  return state.draws.length ? state.draws[state.draws.length - 1] : null;
}

// 지금 사는 번호가 해당하는 회차(추첨이 끝난 마지막 회차 다음)
export function targetRound() {
  return Math.max(latestDraw()?.n || 0, expectedLatest()) + 1;
}

// ───────── 저장한 번호 ─────────

// games: [{ nums:[6], kind:'auto'|'semi'|'manual', mode:'random'|'stats' }]
// opts.fixed 이면 회차에 묶지 않는 "고정 번호"로 저장한다(매주 같은 번호로 찍을 때). 이미 있는 번호는 건너뛴다.
export function saveGames(games, opts = {}) {
  const round = targetRound();
  const now = Date.now();
  const fixed = Boolean(opts.fixed);
  const have = new Set(state.tickets.filter((t) => t.fixed).map((t) => t.nums.join(',')));
  const made = [];
  games.forEach((g, i) => {
    const nums = [...g.nums].sort((a, b) => a - b);
    if (fixed && have.has(nums.join(','))) return;
    made.push({
      id: newId(),
      nums,
      kind: g.kind,
      mode: g.mode || null,
      round: fixed ? null : round,
      fixed,
      since: round, // 저장한 시점의 다음 회차 — 고정 번호는 이 회차부터 결과를 센다
      createdAt: now + i,
    });
  });
  if (made.length) {
    state = { ...state, tickets: [...made, ...state.tickets] };
    persist();
    listeners.forEach((l) => l());
  }
  return made;
}

export function removeTicket(id) {
  const gone = state.tickets.find((t) => t.id === id) || null;
  state = { ...state, tickets: state.tickets.filter((t) => t.id !== id) };
  persist();
  listeners.forEach((l) => l());
  return gone;
}

export function restoreTicket(ticket) {
  if (state.tickets.some((t) => t.id === ticket.id)) return;
  state = { ...state, tickets: [ticket, ...state.tickets].sort((a, b) => b.createdAt - a.createdAt) };
  persist();
  listeners.forEach((l) => l());
}

export function removeTickets(ids) {
  const set = new Set(ids);
  state = { ...state, tickets: state.tickets.filter((t) => !set.has(t.id)) };
  persist();
  listeners.forEach((l) => l());
}


