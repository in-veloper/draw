import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { refresh, useStore } from './store';
import MyRegion from './MyRegion';
import TodayPick from './TodayPick';
import { colors, font, radius, shadow } from './theme';
import { Ball, Button, Icon, Sheet } from './ui';
import { drawTime, evaluate, expectedLatest, wonShort } from './lotto';

const RANK_NAMES = ['2등', '3등', '4등', '5등'];
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

// 다음 추첨까지 남은 날짜 표시
function nextDrawLabel(latestN) {
  const n = Math.max(latestN, expectedLatest()) + 1;
  const t = drawTime(n);
  const kst = new Date(t + 9 * 3600 * 1000);
  const today = new Date(Date.now() + 9 * 3600 * 1000);
  const days = Math.round(
    (Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) -
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
      86400000
  );
  const when = `${WEEKDAY[kst.getUTCDay()]} ${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
  return { n, text: days <= 0 ? `오늘 ${when}` : `D-${days} · ${when}` };
}

// 억 단위로만 짧게(총 판매금액 표시용)
function eok(n) {
  return `${Math.round(n / 100000000).toLocaleString('ko-KR')}억원`;
}

export default function Results({ onGoMine, onShowShop, onToast }) {
  const { width } = useWindowDimensions();
  const { draws, loading, failed, tickets } = useStore();
  const [sel, setSel] = useState(null); // null 이면 가장 최근 회차
  const [jump, setJump] = useState(false);
  const [jumpText, setJumpText] = useState('');

  const byN = useMemo(() => new Map(draws.map((d) => [d.n, d])), [draws]);
  const latest = draws.length ? draws[draws.length - 1] : null;
  const draw = sel && byN.get(sel) ? byN.get(sel) : latest;

  // 이 회차에 걸어 둔 내 번호의 결과
  const mine = useMemo(() => {
    if (!draw) return null;
    const list = tickets.filter((t) => t.round === draw.n);
    if (!list.length) return null;
    const results = list.map((t) => evaluate(t.nums, draw));
    const best = results.reduce((b, r) => (r.rank && (!b || r.rank < b) ? r.rank : b), 0);
    return { count: list.length, best };
  }, [tickets, draw]);

  if (!draw) {
    return (
      <View style={s.empty}>
        <Text style={s.brand}>드로우</Text>
        <Text style={s.emptyText}>{failed ? '당첨 번호를 불러오지 못했어요' : '불러오는 중…'}</Text>
        {failed && <Button text="다시 시도" onPress={refresh} style={{ marginTop: 16, width: 160 }} />}
      </View>
    );
  }

  const next = nextDrawLabel(latest.n);
  const inner = width - 40 - 36;
  const ball = Math.min(44, Math.floor((inner - 22) / 7));
  const isLatest = draw.n === latest.n;

  const go = (delta) => {
    const n = draw.n + delta;
    if (byN.has(n)) setSel(n === latest.n ? null : n);
  };

  const submitJump = () => {
    const n = Number(jumpText);
    if (byN.has(n)) {
      setSel(n === latest.n ? null : n);
      setJump(false);
      setJumpText('');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* 화면 높이에 다 들어가게 촘촘히 짠다. 아주 작은 기기에서만 스크롤이 생긴다. */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 20, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.top}>
          <Text style={s.brand}>드로우</Text>
          {isLatest ? (
            <View style={s.pill}>
              <View style={s.pillDot} />
              <Text style={s.pillText}>
                {next.n}회 {next.text}
              </Text>
            </View>
          ) : (
            <Pressable onPress={() => setSel(null)} style={[s.pill, { backgroundColor: colors.ink, borderColor: colors.ink }]}>
              <Text style={[s.pillText, { color: colors.onInk }]}>최신 회차로</Text>
            </Pressable>
          )}
        </View>

        <View style={[s.hero, shadow]}>
          <View style={s.heroGlow} />
          <View style={s.nav}>
            <Pressable onPress={() => go(-1)} disabled={!byN.has(draw.n - 1)} hitSlop={10} style={[s.arrow, !byN.has(draw.n - 1) && { opacity: 0.25 }]}>
              <Icon name="left" size={20} color={colors.onInk} />
            </Pressable>
            <Pressable onPress={() => setJump(true)} style={s.navTitle}>
              <Text style={s.round}>제 {draw.n}회</Text>
              <Text style={s.date}>{draw.date}</Text>
            </Pressable>
            <Pressable onPress={() => go(1)} disabled={!byN.has(draw.n + 1)} hitSlop={10} style={[s.arrow, !byN.has(draw.n + 1) && { opacity: 0.25 }]}>
              <Icon name="right" size={20} color={colors.onInk} />
            </Pressable>
          </View>

          <View style={s.balls}>
            {draw.nums.map((x) => (
              <Ball key={x} n={x} size={ball} />
            ))}
            <Text style={s.plus}>+</Text>
            <Ball n={draw.bonus} size={ball} />
          </View>

          {mine && (
            <Pressable onPress={onGoMine} style={s.mine}>
              <Icon name="ticket" size={15} color={colors.gold} />
              <Text style={s.mineText}>
                내 번호 {mine.count}게임 · {mine.best ? `최고 ${mine.best}등` : '낙첨'}
              </Text>
              <Icon name="right" size={14} color={colors.onInkSoft} />
            </Pressable>
          )}
        </View>

        <TodayPick onToast={onToast} />

        <View style={s.prizeCard}>
          <View style={s.prizeHead}>
            <Text style={s.prizeLabel}>1등 당첨금</Text>
            <Text style={s.prizeMeta} numberOfLines={1}>
              {draw.winners[0] ? `${draw.winners[0].toLocaleString('ko-KR')}명` : '이월'}
              {draw.sales > 0 ? ` · 총 판매 ${eok(draw.sales)}` : ''}
            </Text>
          </View>
          <Text style={s.prizeBig} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {draw.prizes[0] ? wonShort(draw.prizes[0]) : '당첨자 없음'}
          </Text>

          <View style={s.grid}>
            {RANK_NAMES.map((name, i) => (
              <View key={name} style={[s.gcell, i % 2 === 0 && s.gcellL, i >= 2 && s.gcellB]}>
                <View style={s.gTop}>
                  <Text style={s.gRank}>{name}</Text>
                  <Text style={s.gCount} numberOfLines={1}>
                    {draw.winners[i + 1].toLocaleString('ko-KR')}명
                  </Text>
                </View>
                <Text style={s.gPrize} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {wonShort(draw.prizes[i + 1])}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {draw.winners[0] > 0 && <MyRegion round={draw.n} onShow={onShowShop} />}

        {loading && <Text style={s.updating}>업데이트 중…</Text>}
      </ScrollView>

      <Sheet visible={jump} title="회차로 이동" onClose={() => setJump(false)}>
        <TextInput
          style={s.jumpInput}
          value={jumpText}
          onChangeText={(t) => setJumpText(t.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder={`1 ~ ${latest.n}`}
          placeholderTextColor={colors.inkFaint}
          keyboardType="number-pad"
          autoFocus
          onSubmitEditing={submitJump}
        />
        <Button text="이동" onPress={submitJump} disabled={!byN.has(Number(jumpText))} style={{ marginTop: 14 }} />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyText: { color: colors.inkSoft, fontFamily: font.semibold, fontSize: 15, marginTop: 16 },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, marginTop: 6, marginBottom: 6 },
  brand: { color: colors.ink, fontFamily: font.bold, fontSize: 22, letterSpacing: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold },
  pillText: { color: colors.ink, fontFamily: font.semibold, fontSize: 12.5 },

  hero: { backgroundColor: colors.ink, borderRadius: 26, paddingTop: 12, paddingBottom: 14, paddingHorizontal: 18, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -80, right: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(231,168,0,0.09)' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  arrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  navTitle: { alignItems: 'center' },
  round: { color: colors.onInk, fontFamily: font.bold, fontSize: 19 },
  date: { color: colors.onInkSoft, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  balls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plus: { color: colors.onInkSoft, fontFamily: font.num, fontSize: 18 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.09)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  mineText: { color: colors.onInk, fontFamily: font.bold, fontSize: 12.5 },

  prizeCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingTop: 14, paddingHorizontal: 18, paddingBottom: 4, marginTop: 12 },
  prizeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  prizeLabel: { color: colors.inkSoft, fontFamily: font.semibold, fontSize: 13 },
  prizeMeta: { flexShrink: 1, color: colors.inkFaint, fontFamily: font.regular, fontSize: 12 },
  prizeBig: { color: colors.ink, fontFamily: font.numLight, fontSize: 34, marginTop: 2, letterSpacing: -0.5 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginHorizontal: -18, borderTopWidth: 1, borderTopColor: colors.line },
  gcell: { width: '50%', paddingVertical: 9, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  gcellL: { borderRightWidth: 1, borderRightColor: colors.line },
  gcellB: { borderBottomWidth: 0 },
  gTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  gRank: { color: colors.inkSoft, fontFamily: font.bold, fontSize: 13 },
  gCount: { flexShrink: 1, color: colors.inkFaint, fontFamily: font.regular, fontSize: 11.5 },
  gPrize: { color: colors.ink, fontFamily: font.num, fontSize: 17, marginTop: 5 },

  updating: { color: colors.inkFaint, fontFamily: font.regular, fontSize: 12, textAlign: 'center', marginTop: 10 },

  jumpInput: { backgroundColor: colors.chip, borderRadius: radius.md, height: 56, textAlign: 'center', color: colors.ink, fontFamily: font.numBold, fontSize: 24 },
});
