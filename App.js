import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';

import { init, useStore } from './src/store';
import { colors, font, radius, shadow } from './src/theme';
import { Fade, Icon, Toast } from './src/ui';
import Results from './src/Results';
import Pick from './src/Pick';
import MyNumbers from './src/MyNumbers';
import Stores from './src/Stores';

SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

const TABS = [
  { key: 'results', label: '당첨번호', icon: 'trophy' },
  { key: 'pick', label: '드로우', icon: 'dice' },
  { key: 'mine', label: '내 번호', icon: 'ticket' },
  { key: 'stores', label: '판매점', icon: 'pin' },
];

function Main() {
  const insets = useSafeAreaInsets();
  const { loaded } = useStore();
  const [tab, setTab] = useState('results');
  const [toast, setToast] = useState(null);
  const [focusShop, setFocusShop] = useState(null); // 당첨번호 화면에서 고른 판매점 → 판매점 탭 지도에서 보여 줄 곳

  useEffect(() => {
    init();
  }, []);

  // 같은 문구가 연달아 나와도 다시 뜨도록 매번 새 객체로 감싼다
  const showToast = useCallback((message, action) => setToast({ message, action, id: Date.now() }), []);
  const hideToast = useCallback(() => setToast(null), []);

  if (!loaded) return <View style={s.fill} />;

  // 화면을 닫지 않고 숨기기만 해서, 고른 번호나 지도 위치가 탭을 옮겨도 남게 한다.
  // 위쪽은 상태바 높이만큼 비워 둔다 — 안쪽이 스크롤돼도 시계·배터리 줄과 겹치지 않는다.
  const show = (key) => [tab === key ? s.fill : s.hidden, { paddingTop: insets.top }];

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <View style={s.fill}>
      <View style={show('results')}>
        <Results
          onGoMine={() => setTab('mine')}
          onToast={showToast}
          onShowShop={(shop) => {
            setFocusShop({ ...shop, key: Date.now() });
            setTab('stores');
          }}
        />
      </View>
      <View style={show('pick')}>
        <Pick onToast={showToast} />
      </View>
      <View style={show('mine')}>
        <MyNumbers onToast={showToast} onGoPick={() => setTab('pick')} />
      </View>
      <View style={show('stores')}>
        <Stores active={tab === 'stores'} focus={focusShop} onToast={showToast} />
      </View>
      <Fade position="top" offset={insets.top} height={14} />
      <Fade position="bottom" height={16} />
      </View>

      <View style={[s.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={s.tabBar}>
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[s.tab, on && s.tabOn]}>
              <Icon name={t.icon} size={on ? 22 : 25} color={on ? colors.onInk : colors.inkFaint} stroke={on ? 2.2 : 1.9} />
              {on && <Text style={s.tabTextOn}>{t.label}</Text>}
            </Pressable>
          );
        })}
      </View>
      </View>

      <Toast message={toast?.message} action={toast?.action} key={toast?.id} onHide={hideToast} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  hidden: { display: 'none' },

  // 메뉴는 화면 맨 아래에 따로 자리를 잡는다 — 내용은 그 위에서 끝나고 메뉴 뒤로 겹쳐 내려가지 않는다
  dock: { backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 8 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 6,
    gap: 4,
    ...shadow,
    elevation: 8,
  },
  // 고른 탭만 아이콘 밑에 이름이 보이고, 나머지는 아이콘만 보인다
  tab: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: radius.md },
  tabOn: { flex: 1.5, backgroundColor: colors.ink },
  tabTextOn: { color: colors.onInk, fontFamily: font.bold, fontSize: 11 },
});
