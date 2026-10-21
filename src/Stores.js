import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import { useStore } from './store';
import { fmtDist, nearby, topUp } from './shops';
import MapSurface from './MapSurface';
import { colors, font, radius, shadow } from './theme';
import { Fade, Icon, IconButton, Segmented } from './ui';

// 위치 권한이 없거나 못 잡을 때의 기준점: 서울시청
const FALLBACK = { lat: 37.5665, lng: 126.978 };
const SORT = [
  { value: 'dist', label: '가까운 순' },
  { value: 'first', label: '1등 많은 순' },
];

function Badge({ text, gold }) {
  return (
    <View style={[s.badge, gold ? s.badgeGold : s.badgeGray]}>
      <Text style={[s.badgeText, gold && { color: '#7A5600' }]}>{text}</Text>
    </View>
  );
}

function ShopCard({ shop, active, onPress }) {
  const open = (url) => Linking.openURL(url).catch(() => {});
  return (
    <Pressable onPress={onPress} style={[s.card, active && s.cardActive]}>
      <View style={s.cardTop}>
        <Text style={s.name} numberOfLines={1}>
          {shop.name}
        </Text>
        <Text style={s.dist}>{fmtDist(shop.dist)}</Text>
      </View>
      <Text style={s.addr} numberOfLines={active ? 2 : 1}>
        {shop.addr}
      </Text>
      <View style={s.badges}>
        <Badge gold={shop.c1 > 0} text={`1등 ${shop.c1}회`} />
        <Badge text={`2등 ${shop.c2}회`} />
        {shop.l1 > 0 && <Text style={s.last}>최근 1등 {shop.l1}회</Text>}
      </View>
      {active && (
        <View style={s.actions}>
          <Pressable
            style={s.actionBtn}
            onPress={() => open(`https://map.kakao.com/link/to/${encodeURIComponent(shop.name)},${shop.lat},${shop.lng}`)}
          >
            <Icon name="route" size={17} color={colors.onInk} />
            <Text style={s.actionText}>길찾기</Text>
          </Pressable>
          {!!shop.tel && (
            <Pressable style={[s.actionBtn, s.actionGhost]} onPress={() => open(`tel:${shop.tel}`)}>
              <Icon name="phone" size={17} color={colors.ink} />
              <Text style={[s.actionText, { color: colors.ink }]}>{shop.tel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function Stores({ active: visible, focus, onToast }) {
  const { draws } = useStore();
  const map = useRef(null);
  const list = useRef(null);
  const moveTimer = useRef(null);

  const [center, setCenter] = useState(FALLBACK); // 목록을 뽑는 기준(지도 중심)
  const [me, setMe] = useState(null); // 내 위치
  const [sort, setSort] = useState('dist');
  const [selected, setSelected] = useState(null);
  const [version, setVersion] = useState(0); // 새 회차 반영 시 다시 계산
  const asked = useRef(false);
  const pendingSelect = useRef(null);

  const items = useMemo(() => {
    const found = nearby(center.lat, center.lng, { refLat: me?.lat ?? center.lat, refLng: me?.lng ?? center.lng });
    return sort === 'first' ? [...found].sort((a, b) => b.c1 - a.c1 || b.c2 - a.c2 || a.centerDist - b.centerDist) : found;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, me, sort, version]);

  // 지도에는 목록과 같은 판매점을 찍는다
  useEffect(() => {
    map.current?.send({ t: 'stores', items: items.map((x) => ({ id: x.id, lat: x.lat, lng: x.lng, c1: x.c1 })) });
  }, [items]);

  const locate = useCallback(async (silent) => {
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (!silent) onToast('위치 권한이 없어 서울시청 기준으로 보여드려요');
        return false;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMe(p);
      setCenter(p);
      setSelected(null);
      map.current?.send({ t: 'me', ...p });
      map.current?.send({ t: 'center', ...p, zoom: 16 });
      return true;
    } catch {
      if (!silent) onToast('내 위치를 찾지 못했어요');
      return false;
    }
  }, [onToast]);

  // 당첨번호 화면에서 판매점을 눌러 들어오면 그 가게 쪽으로 지도를 옮기고 골라 둔다
  useEffect(() => {
    if (!focus) return;
    asked.current = true;
    const p = { lat: focus.lat, lng: focus.lng };
    pendingSelect.current = focus.id;
    setCenter(p);
    setSelected(focus.id);
    map.current?.send({ t: 'center', ...p, zoom: 16 });
  }, [focus]);

  // 목록이 새로 계산되면, 골라 둔 가게를 지도에서 강조한다
  useEffect(() => {
    if (pendingSelect.current == null) return undefined;
    const id = pendingSelect.current;
    if (!items.some((x) => x.id === id)) return undefined;
    pendingSelect.current = null;
    const t = setTimeout(() => {
      map.current?.send({ t: 'select', id });
      const idx = items.findIndex((x) => x.id === id);
      if (idx >= 0) list.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 });
    }, 500);
    return () => clearTimeout(t);
  }, [items]);

  // 이 탭을 처음 열 때 한 번만 위치를 묻는다
  useEffect(() => {
    if (visible && !asked.current) {
      asked.current = true;
      locate(false);
    }
  }, [visible, locate]);

  // 번들 데이터 이후에 나온 회차가 있으면 판매점 횟수에 더한다
  const latest = draws.length ? draws[draws.length - 1].n : 0;
  useEffect(() => {
    if (latest) topUp(latest).then((n) => n && setVersion((v) => v + 1)).catch(() => {});
  }, [latest]);

  const onMessage = (m) => {
    if (m.t === 'move') {
      clearTimeout(moveTimer.current);
      moveTimer.current = setTimeout(() => setCenter({ lat: m.lat, lng: m.lng }), 450);
    } else if (m.t === 'select') {
      setSelected(m.id);
      const idx = items.findIndex((x) => x.id === m.id);
      if (idx >= 0) list.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 });
    }
  };

  const pick = (shop) => {
    const same = selected === shop.id;
    setSelected(same ? null : shop.id);
    if (!same) map.current?.send({ t: 'select', id: shop.id });
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Segmented small options={SORT} value={sort} onChange={setSort} />
        </View>
      </View>

      <View style={s.mapBox}>
        <MapSurface ref={map} onMessage={onMessage} />
        <View style={s.locate}>
          <IconButton name="locate" size={44} color={colors.ink} onPress={() => locate(false)} style={s.locateBtn} />
        </View>
      </View>

      {/* 목록은 지도 아래에 여백을 두고 시작하고, 위쪽은 길게 옅어지게 해서 카드가 일직선으로 잘려 보이지 않는다 */}
      <View style={s.listWrap}>
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(x) => String(x.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item }) => <ShopCard shop={item} active={selected === item.id} onPress={() => pick(item)} />}
        ListEmptyComponent={<Text style={s.empty}>이 지역에는 정보가 없어요</Text>}
      />
      <Fade position="top" height={34} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 14, marginBottom: 12 },
  title: { color: colors.ink, fontFamily: font.bold, fontSize: 24 },

  mapBox: { flex: 1, marginHorizontal: 20, borderRadius: 26, overflow: 'hidden', backgroundColor: '#ECEAE4', borderWidth: 1, borderColor: colors.line },
  listWrap: { flex: 1.15, marginTop: 6 },
  locate: { position: 'absolute', right: 12, bottom: 12 },
  locateBtn: { backgroundColor: colors.surface, ...shadow },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, padding: 14 },
  cardActive: { borderColor: colors.ink },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, color: colors.ink, fontFamily: font.bold, fontSize: 15.5 },
  dist: { color: colors.inkSoft, fontFamily: font.num, fontSize: 13 },
  addr: { color: colors.inkSoft, fontFamily: font.regular, fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeGold: { backgroundColor: colors.goldSoft },
  badgeGray: { backgroundColor: colors.chip },
  badgeText: { color: colors.inkSoft, fontFamily: font.bold, fontSize: 11.5 },
  last: { color: colors.inkFaint, fontFamily: font.regular, fontSize: 11.5, marginLeft: 4 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 42, borderRadius: radius.md, backgroundColor: colors.ink },
  actionGhost: { backgroundColor: colors.chip },
  actionText: { color: colors.onInk, fontFamily: font.bold, fontSize: 13.5 },

  empty: { textAlign: 'center', color: colors.inkFaint, fontFamily: font.regular, fontSize: 14, paddingVertical: 24 },
});
