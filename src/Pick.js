import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

import { removeTickets, saveGames, targetRound, useStore } from './store';
import { ALL, makeGame, statsOf } from './gen';
import { ballColor, colors, font, radius } from './theme';
import { Ball, Button, Icon, IconButton, Segmented } from './ui';

const COMPOSE = [
  { value: 'auto', label: '자동' },
  { value: 'semi', label: '반자동' },
  { value: 'manual', label: '수동' },
];
const METHOD = [
  { value: 'random', label: '무작위' },
  { value: 'stats', label: 'AI' },
];
const LEAN = [
  { value: 'hot', label: '자주 나온 번호' },
  { value: 'cold', label: '오래 안 나온 번호' },
];
const ALL_RANGE = 99999; // "전체 회차"
const RANGES = [30, 50, 100, 200, ALL_RANGE];
const rangeLabel = (r) => (r === ALL_RANGE ? "전체" : `${r}회`);
const LABELS = ['A', 'B', 'C', 'D', 'E'];

function tap() {
  Haptics.selectionAsync().catch(() => {});
}

// 번호 구간 색에 알파를 얹은 색(#RRGGBB + 0~1)
function tint(hex, alpha) {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

// 1~45 를 한눈에: 번호마다 자기 구간 색(노랑·파랑·빨강·회색·초록)을 옅게 깔고, 고르면 윤기 나는 공으로 바뀐다.
// 통계 모드에서는 많이 나온 번호일수록 그 색이 진해진다.
function Grid({ picks, onToggle, heat }) {
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 40 - 28 - 8 * 6) / 9);
  return (
    <View style={s.grid}>
      {ALL.map((n) => {
        const on = picks.includes(n);
        const c = ballColor(n);
        const h = heat ? heat[n] : 0;
        const bgA = heat ? 0.1 + h * 0.5 : 0.14;
        return (
          <Pressable key={n} onPress={() => onToggle(n)} style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}>
            {on ? (
              <Ball n={n} size={cell} />
            ) : (
              <View
                style={[
                  s.cell,
                  {
                    width: cell - 4,
                    height: cell - 4,
                    borderRadius: (cell - 4) / 2,
                    backgroundColor: tint(c.bg, bgA),
                    borderColor: tint(c.bg, heat ? 0.25 + h * 0.5 : 0.4),
                  },
                ]}
              >
                <Text style={[s.cellText, { color: c.deep }, heat && h > 0.55 && { fontFamily: font.numBold }]}>{n}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// 고른 번호가 차곡차곡 쌓이는 칸(최대 6칸). 비어 있는 칸은 점선 원으로 보인다.
function Slots({ picks, total = 6 }) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - 40 - 28 - 24 - 5 * 8) / 6);
  const sorted = [...picks].sort((a, b) => a - b);
  return (
    <View style={s.slots}>
      {Array.from({ length: total }, (_, i) =>
        sorted[i] ? (
          <Ball key={`n${sorted[i]}`} n={sorted[i]} size={size} />
        ) : (
          <View key={`e${i}`} style={[s.slot, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={s.slotText}>{i + 1}</Text>
          </View>
        )
      )}
    </View>
  );
}

function GameCard({ game, index, onReroll, onSave, canReroll }) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - 40 - 36 - 24 - 5 * 6) / 6);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 380, delay: index * 70, useNativeDriver: true }).start();
  }, [anim, index, game.id]);

  return (
    <Animated.View
      style={[
        s.game,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
      ]}
    >
      <View style={s.gameHead}>
        <View style={s.gameLabel}>
          <Text style={s.gameLabelText}>{LABELS[index] || index + 1}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {canReroll && <IconButton name="refresh" size={36} color={colors.inkSoft} onPress={() => onReroll(index)} />}
      </View>
      <View style={s.tray}>
        {game.nums.map((n) => (
          <Ball key={n} n={n} size={size} />
        ))}
      </View>
      {game.saved ? (
        <View style={[s.saveBtn, s.saveBtnOn, { marginTop: 16 }]}>
          <Icon name="check" size={16} color={colors.good} stroke={2.3} />
          <Text style={[s.saveText, { color: colors.good }]}>{game.saved === 'fixed' ? '고정 번호로 저장됨' : '저장됨'}</Text>
        </View>
      ) : (
        <View style={s.saveRow}>
          <Pressable onPress={() => onSave(index, false)} style={({ pressed }) => [s.saveBtn, { flex: 1.5 }, pressed && { opacity: 0.8 }]}>
            <Text style={s.saveText}>{targetRound()}회로 저장</Text>
          </Pressable>
          <Pressable onPress={() => onSave(index, true)} style={({ pressed }) => [s.saveBtn, { flex: 1 }, pressed && { opacity: 0.8 }]}>
            <Text style={s.saveText}>고정 저장</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

export default function Pick({ onToast }) {
  const { draws } = useStore();
  const [compose, setCompose] = useState('auto');
  const [method, setMethod] = useState('random');
  const [range, setRange] = useState(100);
  const [lean, setLean] = useState('hot');
  const [count, setCount] = useState(5);
  const [picks, setPicks] = useState([]);
  const [games, setGames] = useState([]);

  const stat = useMemo(() => (draws.length ? statsOf(draws, range) : null), [draws, range]);
  const limit = compose === 'manual' ? 6 : 5;
  const usesMethod = compose !== 'manual';

  // 통계 모드에서 번호판에 깔아 줄 출현 빈도(0~1)
  const heat = useMemo(() => {
    if (!stat || method !== 'stats' || !usesMethod) return null;
    const max = Math.max(...stat.freq.slice(1), 1);
    return stat.freq.map((f) => f / max);
  }, [stat, method, usesMethod]);

  // 통계 요약: 선택한 방향의 상위 번호
  const insight = useMemo(() => {
    if (!stat || method !== 'stats' || !usesMethod) return [];
    const score = lean === 'hot' ? stat.freq : stat.gap;
    return ALL.slice()
      .sort((a, b) => score[b] - score[a] || a - b)
      .slice(0, 6)
      .sort((a, b) => a - b);
  }, [stat, method, lean, usesMethod]);

  const toggle = (n) => {
    tap();
    setPicks((p) => {
      if (p.includes(n)) return p.filter((x) => x !== n);
      if (p.length >= limit) return p;
      return [...p, n];
    });
  };

  const changeCompose = (v) => {
    setCompose(v);
    setPicks((p) => p.slice(0, v === 'manual' ? 6 : 5));
    setGames([]);
  };

  const opts = { mode: method, draws, range, lean };

  const make = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (compose === 'manual') {
      if (picks.length !== 6) return;
      setGames([{ id: `${Date.now()}`, nums: [...picks].sort((a, b) => a - b), kind: 'manual', mode: null, saved: false }]);
      return;
    }
    const fixed = compose === 'semi' ? picks : [];
    const seen = new Set();
    const out = [];
    let guard = 0;
    while (out.length < count && guard < 200) {
      guard += 1;
      const nums = makeGame({ fixed, ...opts });
      const key = nums.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `${Date.now()}-${out.length}`, nums, kind: compose, mode: method, saved: false });
    }
    setGames(out);
  };

  const reroll = (i) => {
    const fixed = compose === 'semi' ? picks : [];
    setGames((g) => g.map((x, k) => (k === i ? { ...x, id: `${Date.now()}-${k}`, nums: makeGame({ fixed, ...opts }), saved: false } : x)));
  };

  const saveOne = (i, fixed = false) => {
    const g = games[i];
    if (!g || g.saved) return;
    const made = saveGames([g], { fixed });
    if (!made.length) {
      onToast('이미 고정 번호로 저장돼 있어요');
      return;
    }
    setGames((list) => list.map((x, k) => (k === i ? { ...x, saved: fixed ? 'fixed' : 'round' } : x)));
    onToast(fixed ? '고정 번호로 저장했어요' : '저장했어요', {
      label: '되돌리기',
      onPress: () => {
        removeTickets(made.map((m) => m.id));
        setGames((list) => list.map((x, k) => (k === i ? { ...x, saved: false } : x)));
      },
    });
  };

  const saveAll = () => {
    const pending = games.filter((g) => !g.saved);
    if (!pending.length) return;
    const made = saveGames(pending);
    setGames((list) => list.map((x) => ({ ...x, saved: true })));
    onToast(`${made.length}게임 저장했어요`, { label: '되돌리기', onPress: () => { removeTickets(made.map((m) => m.id)); setGames((list) => list.map((x) => ({ ...x, saved: false }))); } });
  };

  const needPick = compose === 'manual' ? 6 - picks.length : compose === 'semi' && picks.length < 1 ? 1 : 0;
  const buttonText =
    compose === 'manual'
      ? picks.length === 6
        ? '이 번호 담기'
        : `${6 - picks.length}개 더 골라주세요`
      : compose === 'semi' && picks.length < 1
        ? '1개 이상 골라주세요'
        : games.length
          ? '다시 드로우'
          : '드로우';
  const pending = games.filter((g) => !g.saved).length;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ height: 16 }} />

      <Segmented options={COMPOSE} value={compose} onChange={changeCompose} />

      {usesMethod && (
        <View style={s.block}>
          <Segmented options={METHOD} value={method} onChange={(v) => { setMethod(v); setGames([]); }} />
          {method === 'stats' && (
            <View style={s.statsBox}>
              <View style={s.rangeRow}>
                {RANGES.map((r) => (
                  <Pressable key={r} onPress={() => setRange(r)} style={[s.rangeChip, range === r && s.rangeChipOn]}>
                    <Text style={[s.rangeText, range === r && s.rangeTextOn]}>{rangeLabel(r)}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ marginTop: 10 }}>
                <Segmented small options={LEAN} value={lean} onChange={setLean} />
              </View>
              {insight.length > 0 && (
                <View style={s.insight}>
                  <Text style={s.insightLabel}>{lean === 'hot' ? '많이 나온 번호' : '오래 쉰 번호'}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {insight.map((n) => (
                      <Ball key={n} n={n} size={28} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {compose !== 'auto' && (
        <View style={[s.block, s.pickBox]}>
          <View style={s.pickHead}>
            <Text style={s.pickTitle}>
              {compose === 'manual' ? '번호 6개 고르기' : '고정할 번호 (최대 5개)'}
              <Text style={s.pickCount}>  {picks.length}/{limit}</Text>
            </Text>
            {picks.length > 0 && (
              <Pressable onPress={() => setPicks([])} hitSlop={8}>
                <Text style={s.clear}>지우기</Text>
              </Pressable>
            )}
          </View>
          <Slots picks={picks} />
          <View style={s.divider} />
          <Grid picks={picks} onToggle={toggle} heat={heat} />
        </View>
      )}

      {compose === 'auto' && heat && (
        <View style={[s.block, s.pickBox]}>
          <View style={s.pickHead}>
            <Text style={s.pickTitle}>출현 빈도</Text>
            <Text style={s.pickCount}>{range === ALL_RANGE ? "전체 회차" : `최근 ${range}회`}</Text>
          </View>
          <Grid picks={[]} onToggle={() => {}} heat={heat} />
        </View>
      )}

      {compose !== 'manual' && (
        <View style={s.countRow}>
          <Text style={s.countLabel}>게임 수</Text>
          <View style={s.stepper}>
            <IconButton name="minus" size={38} color={colors.ink} style={s.stepBtn} onPress={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1} />
            <Text style={s.countValue}>{count}</Text>
            <IconButton name="plus" size={38} color={colors.ink} style={s.stepBtn} onPress={() => setCount((c) => Math.min(5, c + 1))} disabled={count >= 5} />
          </View>
        </View>
      )}

      <Button text={buttonText} onPress={make} disabled={needPick > 0} icon={needPick > 0 ? undefined : 'dice'} style={{ marginTop: 18 }} />

      {games.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <View style={s.resultHead}>
            <Text style={s.resultTitle}>{games.length}게임</Text>
            {pending > 0 && games.length > 1 && (
              <Pressable onPress={saveAll} hitSlop={8} style={s.saveAll}>
                <Text style={s.saveAllText}>모두 저장</Text>
              </Pressable>
            )}
          </View>
          <View style={{ gap: 12 }}>
            {games.map((g, i) => (
              <GameCard key={g.id} game={g} index={i} canReroll={compose !== 'manual'} onReroll={reroll} onSave={saveOne} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { color: colors.ink, fontFamily: font.bold, fontSize: 24, marginTop: 14, marginBottom: 16 },
  block: { marginTop: 14 },

  statsBox: { marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14 },
  rangeRow: { flexDirection: 'row', gap: 6 },
  rangeChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.chip },
  rangeChipOn: { backgroundColor: colors.ink },
  rangeText: { color: colors.inkSoft, fontFamily: font.semibold, fontSize: 12 },
  rangeTextOn: { color: colors.onInk, fontFamily: font.bold },
  insight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  insightLabel: { color: colors.inkSoft, fontFamily: font.semibold, fontSize: 12.5 },

  pickBox: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14 },
  pickHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  slots: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, paddingHorizontal: 12 },
  slot: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D3D0C8' },
  slotText: { color: '#C2BFB6', fontFamily: font.num, fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  pickTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 15 },
  pickCount: { color: colors.inkFaint, fontFamily: font.num, fontSize: 14 },
  clear: { color: colors.inkSoft, fontFamily: font.semibold, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.2 },
  cellText: { fontFamily: font.num, fontSize: 13 },

  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  countLabel: { color: colors.ink, fontFamily: font.bold, fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { backgroundColor: colors.chip },
  countValue: { width: 36, textAlign: 'center', color: colors.ink, fontFamily: font.numBold, fontSize: 22 },

  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  resultTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 17 },
  saveAll: { backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  saveAllText: { color: colors.onInk, fontFamily: font.bold, fontSize: 12.5 },

  game: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 18 },
  gameHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  gameLabel: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  gameLabelText: { color: colors.onInk, fontFamily: font.numBold, fontSize: 13 },
  gameKind: { color: colors.inkSoft, fontFamily: font.semibold, fontSize: 12.5 },
  // 공이 놓이는 영역: 늘 같은 크기의 칸 여섯 개가 한 상자 안에 가지런히
  tray: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F3F1EC', borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingVertical: 14, paddingHorizontal: 12 },
  saveRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 42, borderRadius: radius.md, backgroundColor: colors.chip },
  saveBtnOn: { backgroundColor: 'rgba(16,160,106,0.1)' },
  saveText: { color: colors.ink, fontFamily: font.bold, fontSize: 13.5 },
});
