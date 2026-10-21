import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { removeTicket, restoreTicket, useStore } from './store';
import { PRICE, drawTime, evaluate, prizeOf, wonShort, ymd } from './lotto';
import { colors, font, radius } from './theme';
import { Ball, Button, Icon, Segmented, Sheet } from './ui';

const KIND = { auto: '자동', semi: '반자동', manual: '수동' };
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

function kindLabel(t) {
  const k = KIND[t.kind] || '';
  return t.mode === 'stats' ? `${k} · AI` : t.mode === 'random' ? `${k} · 무작위` : k;
}

function rankChip(result, pending) {
  if (pending) return { text: '추첨 전', bg: colors.chip, fg: colors.inkSoft };
  if (!result.rank) return { text: '낙첨', bg: colors.chip, fg: colors.inkFaint };
  if (result.rank <= 3) return { text: `${result.rank}등`, bg: colors.gold, fg: '#FFFFFF' };
  return { text: `${result.rank}등`, bg: colors.ink, fg: '#FFFFFF' };
}

// 번호 한 게임을 담는 티켓 카드: 위에 이름·종류·결과, 가운데 공 상자, 아래에 당첨금이나 이력
function Ticket({ label, ticket, result, pending, footer, side, onMenu, size }) {
  const chip = rankChip(result, pending);
  return (
    <Pressable onPress={onMenu} style={({ pressed }) => [s.ticket, pressed && { opacity: 0.85 }]}>
      <View style={s.tHead}>
        <View style={s.tLabel}>
          <Text style={s.tLabelText}>{label}</Text>
        </View>
        <Text style={s.tKind} numberOfLines={1}>
          {kindLabel(ticket)}
          {result?.rank === 2 ? ' · 보너스 일치' : ''}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={[s.chip, { backgroundColor: chip.bg }]}>
          <Text style={[s.chipText, { color: chip.fg }]}>{chip.text}</Text>
        </View>
        <Pressable onPress={onMenu} hitSlop={8} style={s.more}>
          <Icon name="more" size={20} color={colors.inkFaint} />
        </Pressable>
      </View>

      <View style={s.tray}>
        {ticket.nums.map((n) => (
          <Ball key={n} n={n} size={size} dim={Boolean(result) && !result.hits.includes(n)} />
        ))}
      </View>

      {!!footer && (
        <View style={s.tFoot}>
          <Text style={[s.tFootText, footer.gold && { color: '#9A6B00', fontFamily: font.bold }]} numberOfLines={1}>
            {footer.text}
          </Text>
          {!!side && <Text style={s.tSide}>{side}</Text>}
        </View>
      )}
    </Pressable>
  );
}

export default function MyNumbers({ onToast, onGoPick }) {
  const { width } = useWindowDimensions();
  const { tickets, draws } = useStore();
  const [menu, setMenu] = useState(null);
  const [view, setView] = useState('rounds'); // rounds | fixed

  const byN = useMemo(() => new Map(draws.map((d) => [d.n, d])), [draws]);
  // 카드 안쪽 폭: 화면 − 바깥 여백 40 − 카드 패딩 28
  const size = Math.floor((width - 40 - 28 - 5 * 8) / 6);

  const groups = useMemo(() => {
    const map = new Map();
    tickets.forEach((t) => {
      if (t.fixed) return; // 고정 번호는 회차 묶음이 아니라 따로 보여 준다
      if (!map.has(t.round)) map.set(t.round, []);
      map.get(t.round).push(t);
    });
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([round, list]) => {
        const draw = byN.get(round) || null;
        const rows = list
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((t) => ({ t, result: draw ? evaluate(t.nums, draw) : null }));
        const best = rows.reduce((b, r) => (r.result?.rank && (!b || r.result.rank < b) ? r.result.rank : b), 0);
        return { round, draw, rows, best };
      });
  }, [tickets, byN]);

  // 고정 번호: 저장한 회차부터 지금까지 모든 추첨에 맞춰 본 결과
  const fixed = useMemo(
    () =>
      tickets
        .filter((t) => t.fixed)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((t) => {
          const played = draws.filter((d) => d.n >= (t.since || 0));
          const results = played.map((d) => evaluate(t.nums, d));
          const wins = results.filter((r) => r.rank).length;
          const best = results.reduce((b, r) => (r.rank && (!b || r.rank < b) ? r.rank : b), 0);
          const last = played.length ? { draw: played[played.length - 1], result: results[results.length - 1] } : null;
          return { t, played: played.length, wins, best, last };
        }),
    [tickets, draws]
  );

  // 확인이 끝난 회차의 사용 금액과 당첨금
  const total = useMemo(() => {
    let games = 0;
    let prize = 0;
    groups.forEach((g) => {
      if (!g.draw) return;
      g.rows.forEach((r) => {
        games += 1;
        prize += prizeOf(r.result.rank, g.draw);
      });
    });
    return { games, spent: games * PRICE, prize };
  }, [groups]);

  // 한쪽만 있을 땐 그쪽을 바로 보여 준다
  useEffect(() => {
    if (view === 'rounds' && !groups.length && fixed.length) setView('fixed');
    if (view === 'fixed' && !fixed.length && groups.length) setView('rounds');
  }, [view, groups.length, fixed.length]);

  const remove = (t) => {
    const gone = removeTicket(t.id);
    setMenu(null);
    if (gone) onToast('삭제했어요', { label: '되돌리기', onPress: () => restoreTicket(gone) });
  };

  if (!tickets.length) {
    return (
      <View style={s.empty}>
        <View style={s.emptyIcon}>
          <Icon name="ticket" size={30} color={colors.inkFaint} />
        </View>
        <Text style={s.emptyTitle}>저장한 번호가 없어요</Text>
        <Button text="드로우 하기" onPress={onGoPick} style={{ marginTop: 18, width: 180 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 14 }} />

        {total.games > 0 && (
          <View style={s.summary}>
            <View style={s.sumCol}>
              <Text style={s.sumLabel}>확인한 게임</Text>
              <Text style={s.sumValue} numberOfLines={1}>
                {total.games}
              </Text>
            </View>
            <View style={s.sumDivider} />
            <View style={s.sumCol}>
              <Text style={s.sumLabel}>사용</Text>
              <Text style={s.sumValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {wonShort(total.spent)}
              </Text>
            </View>
            <View style={s.sumDivider} />
            <View style={[s.sumCol, s.sumColWide]}>
              <Text style={s.sumLabel}>당첨금</Text>
              <Text style={[s.sumValue, total.prize > 0 && { color: colors.gold }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {wonShort(total.prize)}
              </Text>
            </View>
          </View>
        )}

        {groups.length > 0 && fixed.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'rounds', label: `회차별 ${groups.reduce((a, g) => a + g.rows.length, 0)}` },
                { value: 'fixed', label: `고정 번호 ${fixed.length}` },
              ]}
            />
          </View>
        )}

        {view === 'rounds' &&
          groups.map((g) => {
            const waiting = !g.draw;
            return (
              <View key={g.round} style={s.group}>
                <View style={s.groupHead}>
                  <View>
                    <Text style={s.groupTitle}>제 {g.round}회</Text>
                    <Text style={s.groupSub}>{g.draw ? `${g.draw.date} 결과` : `${ymd(drawTime(g.round))} 추첨`}</Text>
                  </View>
                  <View style={[s.best, g.best > 0 ? s.bestWin : waiting && s.bestWait]}>
                    <Text style={[s.bestText, g.best > 0 && { color: '#7A5600' }]}>{waiting ? '추첨 대기' : g.best ? `최고 ${g.best}등` : '낙첨'}</Text>
                  </View>
                </View>

                {g.draw && (
                  <View style={s.winStrip}>
                    <Text style={s.winLabel}>당첨번호</Text>
                    <View style={s.winBalls}>
                      {g.draw.nums.map((n) => (
                        <Ball key={n} n={n} size={26} />
                      ))}
                      <Text style={s.winPlus}>+</Text>
                      <Ball n={g.draw.bonus} size={26} />
                    </View>
                  </View>
                )}

                <View style={{ gap: 10 }}>
                  {g.rows.map(({ t, result }, i) => {
                    const prize = g.draw ? prizeOf(result.rank, g.draw) : 0;
                    return (
                      <Ticket
                        key={t.id}
                        label={LABELS[i] || String(i + 1)}
                        ticket={t}
                        result={result}
                        pending={waiting}
                        size={size}
                        onMenu={() => setMenu(t)}
                        footer={prize > 0 ? { text: `${result.rank}등 당첨 · ${wonShort(prize)}`, gold: true } : null}
                      />
                    );
                  })}
                </View>
              </View>
            );
          })}

        {view === 'fixed' && (
          <View style={{ gap: 10 }}>
            {fixed.map((f, i) => (
              <Ticket
                key={f.t.id}
                label={LABELS[i] || String(i + 1)}
                ticket={f.t}
                result={f.last ? f.last.result : null}
                pending={!f.last}
                size={size}
                onMenu={() => setMenu(f.t)}
                footer={{
                  text: f.played
                    ? `${f.t.since}회부터 ${f.played}회 중 ${f.wins}번 당첨${f.best ? ` · 최고 ${f.best}등` : ''}`
                    : `${f.t.since}회부터 확인`,
                  gold: f.wins > 0,
                }}
                side={f.last ? `${f.last.draw.n}회 기준` : ''}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Sheet visible={Boolean(menu)} title={menu ? (menu.fixed ? `고정 번호 · ${kindLabel(menu)}` : `제 ${menu.round}회 · ${kindLabel(menu)}`) : ''} onClose={() => setMenu(null)}>
        {menu && (
          <>
            <View style={s.menuBalls}>
              {menu.nums.map((n) => (
                <Ball key={n} n={n} size={42} />
              ))}
            </View>
            <Button kind="ghost" text="삭제" onPress={() => remove(menu)} style={{ marginTop: 18 }} />
          </>
        )}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.inkSoft, fontFamily: font.semibold, fontSize: 15, marginTop: 16 },

  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: 18, marginBottom: 18 },
  sumCol: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  sumColWide: { flex: 1.5 },
  sumDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.14)' },
  sumLabel: { color: colors.onInkSoft, fontFamily: font.semibold, fontSize: 12, marginBottom: 6 },
  sumValue: { color: colors.onInk, fontFamily: font.numBold, fontSize: 16 },

  group: { marginBottom: 22 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 2 },
  groupTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 20 },
  groupSub: { color: colors.inkFaint, fontFamily: font.regular, fontSize: 12.5, marginTop: 3 },
  best: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.chip },
  bestWin: { backgroundColor: colors.goldSoft },
  bestWait: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  bestText: { color: colors.inkSoft, fontFamily: font.bold, fontSize: 12.5 },

  winStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10 },
  winLabel: { color: colors.onInkSoft, fontFamily: font.semibold, fontSize: 12 },
  winBalls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  winPlus: { color: colors.onInkSoft, fontFamily: font.num, fontSize: 12, marginHorizontal: 1 },

  ticket: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14 },
  tHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  tLabel: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  tLabelText: { color: colors.onInk, fontFamily: font.numBold, fontSize: 12 },
  tKind: { flexShrink: 1, color: colors.inkSoft, fontFamily: font.semibold, fontSize: 12.5 },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill, minWidth: 52, alignItems: 'center' },
  chipText: { fontFamily: font.bold, fontSize: 12.5 },
  more: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  tray: { flexDirection: 'row', justifyContent: 'space-between' },
  tFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 14 },
  tFootText: { flexShrink: 1, color: colors.inkSoft, fontFamily: font.semibold, fontSize: 12.5 },
  tSide: { color: colors.inkFaint, fontFamily: font.regular, fontSize: 11.5 },

  menuBalls: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
