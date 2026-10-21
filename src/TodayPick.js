import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { removeTickets, saveGames, targetRound, useStore } from './store';
import { makeGame, seeded } from './gen';
import { colors, font, radius } from './theme';
import { Ball, Icon } from './ui';

// 오늘 날짜(한국 시간)
function today() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// 당첨번호 화면의 "오늘의 번호": 드로우의 AI 방식(최근 100회 출현 통계 + 균형 조건)으로 하루에 하나 추천한다.
// 같은 날에는 같은 번호가 나오고, 새로고침을 누르면 다른 번호로 바뀐다.
export default function TodayPick({ onToast }) {
  const { width } = useWindowDimensions();
  const { draws } = useStore();
  const [nonce, setNonce] = useState(0);
  const [savedIds, setSavedIds] = useState(null);

  const latestN = draws.length ? draws[draws.length - 1].n : 0;
  const nums = useMemo(() => {
    if (draws.length < 10) return null;
    return makeGame({ mode: 'stats', draws, range: 100, lean: 'hot', rng: seeded(`${today()}-${latestN}-${nonce}`) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draws.length, latestN, nonce]);

  if (!nums) return null;

  const size = Math.floor((width - 40 - 32 - 5 * 8) / 6);

  const save = () => {
    if (savedIds) return;
    const made = saveGames([{ nums, kind: 'auto', mode: 'stats' }]);
    const ids = made.map((m) => m.id);
    setSavedIds(ids);
    onToast(`${targetRound()}회 번호로 저장했어요`, {
      label: '되돌리기',
      onPress: () => {
        removeTickets(ids);
        setSavedIds(null);
      },
    });
  };

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>오늘의 번호</Text>
        <View style={s.ai}>
          <Text style={s.aiText}>AI</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => {
            setNonce((n) => n + 1);
            setSavedIds(null);
          }}
          hitSlop={8}
          style={s.btn}
        >
          <Icon name="refresh" size={17} color={colors.inkSoft} />
        </Pressable>
        <Pressable onPress={save} disabled={Boolean(savedIds)} hitSlop={8} style={[s.btn, savedIds && s.btnOn]}>
          <Icon name={savedIds ? 'check' : 'ticket'} size={17} color={savedIds ? colors.good : colors.ink} stroke={2.2} />
        </Pressable>
      </View>
      <View style={s.tray}>
        {nums.map((n) => (
          <Ball key={n} n={n} size={size} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14, marginTop: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { color: colors.ink, fontFamily: font.bold, fontSize: 15 },
  ai: { backgroundColor: colors.goldSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  aiText: { color: '#7A5600', fontFamily: font.numBold, fontSize: 11, letterSpacing: 0.5 },
  btn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  btnOn: { backgroundColor: 'rgba(16,160,106,0.12)' },
  tray: { flexDirection: 'row', justifyContent: 'space-between' },
});
