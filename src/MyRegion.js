import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import { distKm, firstPlaceShops, fmtDist, regionAt } from './shops';
import { colors, font, radius } from './theme';
import { Icon } from './ui';

let lastPos = null; // 한 번 잡은 위치는 앱이 켜져 있는 동안 재사용

async function getPos() {
  if (lastPos) return lastPos;
  let p = null;
  try {
    p = await Location.getLastKnownPositionAsync();
  } catch {
    p = null;
  }
  if (!p) p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  lastPos = { lat: p.coords.latitude, lng: p.coords.longitude };
  return lastPos;
}

// 당첨번호 화면 맨 아래: "우리 지역에서 1등이 나왔어요 — 판매점은 여기예요"
export default function MyRegion({ round, onShow }) {
  const [status, setStatus] = useState('check'); // check | ask | denied | loading | ready | none
  const [info, setInfo] = useState(null);

  const run = useCallback(async () => {
    setStatus('loading');
    try {
      const pos = await getPos();
      const region = regionAt(pos.lat, pos.lng);
      const shops = (await firstPlaceShops(round)).map((s) => ({ ...s, dist: distKm(pos.lat, pos.lng, s.lat, s.lng) }));
      if (!shops.length || !region) {
        setStatus('none');
        return;
      }
      const byDist = [...shops].sort((a, b) => a.dist - b.dist);
      const sameCity = byDist.filter((s) => s.addr.startsWith(`${region.sido} ${region.city}`));
      const sameSido = byDist.filter((s) => s.addr.startsWith(`${region.sido} `));
      if (sameCity.length) setInfo({ level: 'city', title: '우리 동네에서 1등이 나왔어요', place: `${region.sido} ${region.city} · ${sameCity.length}곳`, list: sameCity });
      else if (sameSido.length) setInfo({ level: 'sido', title: `${region.sido}에서 1등이 나왔어요`, place: `${region.sido} · ${sameSido.length}곳`, list: sameSido });
      else setInfo({ level: 'far', title: '이번 회차엔 우리 지역에서 1등이 안 나왔어요', place: '가장 가까운 1등 판매점', list: byDist.slice(0, 1) });
      setStatus('ready');
    } catch {
      setStatus('none');
    }
  }, [round]);

  // 위치 권한이 이미 있으면 바로 보여주고, 없으면 눌러서 허용하도록 한다
  useEffect(() => {
    let alive = true;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!alive) return;
      if (perm?.granted) run();
      else setStatus(perm?.canAskAgain === false ? 'denied' : 'ask');
    })();
    return () => {
      alive = false;
    };
  }, [run]);

  const ask = async () => {
    const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (perm?.granted) run();
    else setStatus('denied');
  };

  if (status === 'check' || status === 'none' || status === 'denied') return null;

  if (status === 'ask') {
    return (
      <Pressable onPress={ask} style={({ pressed }) => [s.askCard, pressed && { opacity: 0.8 }]}>
        <View style={s.pinCircle}>
          <Icon name="pin" size={20} color="#7A5600" />
        </View>
        <Text style={s.askText}>우리 지역 1등 판매점 보기</Text>
        <Icon name="right" size={18} color={colors.inkFaint} />
      </Pressable>
    );
  }

  if (status === 'loading' || !info) return null;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.pinCircle}>
          <Icon name="pin" size={20} color="#7A5600" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {info.title}
          </Text>
          <Text style={s.place} numberOfLines={1}>
            {info.place}
          </Text>
        </View>
      </View>

      <View style={{ gap: 8, marginTop: 12 }}>
        {info.list.slice(0, 1).map((shop) => (
          <Pressable key={shop.id} onPress={() => onShow(shop)} style={({ pressed }) => [s.shop, pressed && { opacity: 0.75 }]}>
            <View style={{ flex: 1 }}>
              <View style={s.nameRow}>
                <Text style={s.name} numberOfLines={1}>
                  {shop.name}
                </Text>
                {!!shop.type && (
                  <View style={s.type}>
                    <Text style={s.typeText}>{shop.type}</Text>
                  </View>
                )}
              </View>
              <Text style={s.addr} numberOfLines={1}>
                {shop.addr}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.dist}>{fmtDist(shop.dist)}</Text>
              <Text style={s.map}>지도</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, marginTop: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pinCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontFamily: font.bold, fontSize: 16 },
  place: { color: colors.inkSoft, fontFamily: font.regular, fontSize: 12.5, marginTop: 3 },

  shop: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, color: colors.ink, fontFamily: font.bold, fontSize: 14.5 },
  type: { backgroundColor: colors.goldSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  typeText: { color: '#7A5600', fontFamily: font.bold, fontSize: 11 },
  addr: { color: colors.inkSoft, fontFamily: font.regular, fontSize: 12, marginTop: 4 },
  dist: { color: colors.ink, fontFamily: font.num, fontSize: 13 },
  map: { color: colors.gold, fontFamily: font.bold, fontSize: 11.5, marginTop: 3 },
  more: { color: colors.inkFaint, fontFamily: font.regular, fontSize: 12, textAlign: 'center', marginTop: 2 },

  askCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, marginTop: 14 },
  askText: { flex: 1, color: colors.ink, fontFamily: font.bold, fontSize: 14.5 },
});
