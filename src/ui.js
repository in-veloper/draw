import React, { useEffect, useId, useRef, useState } from 'react';
import { Animated, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { ballColor, colors, font, radius } from './theme';

// ───────── 아이콘 ─────────

export function Icon({ name, size = 22, color = colors.ink, stroke = 2 }) {
  const p = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  let body = null;
  switch (name) {
    case 'trophy':
      body = (
        <>
          <Path d="M8 4 H16 V10 A4 4 0 0 1 8 10 Z" {...p} />
          <Path d="M8 6 H5 A3 3 0 0 0 8 11 M16 6 H19 A3 3 0 0 1 16 11" {...p} />
          <Path d="M12 14 V18 M8.5 20 H15.5" {...p} />
        </>
      );
      break;
    case 'dice':
      body = (
        <>
          <Rect x="4" y="4" width="16" height="16" rx="4" {...p} />
          <Circle cx="9" cy="9" r="1.1" fill={color} />
          <Circle cx="15" cy="9" r="1.1" fill={color} />
          <Circle cx="12" cy="12" r="1.1" fill={color} />
          <Circle cx="9" cy="15" r="1.1" fill={color} />
          <Circle cx="15" cy="15" r="1.1" fill={color} />
        </>
      );
      break;
    case 'ticket':
      body = (
        <>
          <Path d="M4 8 A2 2 0 0 0 4 12 V15 A2 2 0 0 0 6 17 H18 A2 2 0 0 0 20 15 V12 A2 2 0 0 0 20 8 V7 A2 2 0 0 0 18 5 H6 A2 2 0 0 0 4 7 Z" {...p} />
          <Path d="M10 5 V17" {...p} strokeDasharray="1.5 2.5" />
        </>
      );
      break;
    case 'pin':
      body = (
        <>
          <Path d="M12 21 C12 21 5 14.5 5 10 A7 7 0 0 1 19 10 C19 14.5 12 21 12 21 Z" {...p} />
          <Circle cx="12" cy="10" r="2.4" {...p} />
        </>
      );
      break;
    case 'plus':
      body = <Path d="M12 5 V19 M5 12 H19" {...p} />;
      break;
    case 'minus':
      body = <Path d="M5 12 H19" {...p} />;
      break;
    case 'left':
      body = <Path d="M14.5 6 L8.5 12 L14.5 18" {...p} />;
      break;
    case 'right':
      body = <Path d="M9.5 6 L15.5 12 L9.5 18" {...p} />;
      break;
    case 'close':
      body = <Path d="M6 6 L18 18 M18 6 L6 18" {...p} />;
      break;
    case 'check':
      body = <Path d="M5 12.5 L10 17.5 L19 7" {...p} />;
      break;
    case 'refresh':
      body = <Path d="M19 8 A8 8 0 1 0 20 13 M19 4 V8 H15" {...p} />;
      break;
    case 'more':
      body = (
        <>
          <Circle cx="5.5" cy="12" r="1.8" fill={color} />
          <Circle cx="12" cy="12" r="1.8" fill={color} />
          <Circle cx="18.5" cy="12" r="1.8" fill={color} />
        </>
      );
      break;
    case 'locate':
      body = (
        <>
          <Circle cx="12" cy="12" r="3.2" {...p} />
          <Path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21" {...p} />
          <Circle cx="12" cy="12" r="7.5" {...p} />
        </>
      );
      break;
    case 'phone':
      body = <Path d="M6 4 H9.5 L11 8.5 L9 10 A11 11 0 0 0 14 15 L15.5 13 L20 14.5 V18 A2 2 0 0 1 18 20 A14 14 0 0 1 4 6 A2 2 0 0 1 6 4 Z" {...p} />;
      break;
    case 'route':
      body = (
        <>
          <Circle cx="6" cy="18" r="2" {...p} />
          <Circle cx="18" cy="6" r="2" {...p} />
          <Path d="M8 18 H14 A3.5 3.5 0 0 0 14 11 H10 A3.5 3.5 0 0 1 10 4 H16" {...p} />
        </>
      );
      break;
    case 'star':
      body = <Path d="M12 3.5 L14.6 9 L20.5 9.7 L16.1 13.7 L17.3 19.5 L12 16.6 L6.7 19.5 L7.9 13.7 L3.5 9.7 L9.4 9 Z" {...p} />;
      break;
    default:
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}

// ───────── 로또 공 ─────────

function mix(hex, to, t) {
  const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = n(hex);
  const [r2, g2, b2] = n(to);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

// 구 모양 명암(왼쪽 위에서 비추는 빛) + 윤기 나는 반사광 + 바닥 그림자, 가운데에 흰 숫자.
// 크기와 상관없이 모든 공이 같은 모양이다. dim 이면 회색으로(맞지 않은 번호).
export function Ball({ n, size = 44, dim }) {
  const c = ballColor(n);
  const base = dim ? '#CFCDC8' : c.bg;
  const light = mix(base, '#FFFFFF', 0.55);
  const deep = dim ? '#AFADA8' : mix(c.deep, '#000000', 0.18);
  // 같은 번호의 공이 화면에 여러 개 있어도(숨겨진 탭 포함) 그라데이션 이름이 겹치지 않게 공마다 고유한 이름을 쓴다
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  return (
    <View
      style={{
        width: size,
        height: size,
        shadowColor: dim ? '#000' : c.deep,
        shadowOpacity: dim ? 0.1 : 0.35,
        shadowRadius: size * 0.16,
        shadowOffset: { width: 0, height: size * 0.07 },
        elevation: dim ? 1 : 3,
        borderRadius: size / 2,
        backgroundColor: base,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`b${id}`} cx="34%" cy="28%" r="82%" fx="30%" fy="24%">
            <Stop offset="0" stopColor={light} />
            <Stop offset="0.38" stopColor={base} />
            <Stop offset="1" stopColor={deep} />
          </RadialGradient>
          <RadialGradient id={`r${id}`} cx="66%" cy="88%" r="46%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dim ? 0.1 : 0.28} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={`s${id}`} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dim ? 0.55 : 0.92} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Circle cx="50" cy="50" r="49" fill={`url(#b${id})`} />
        <Circle cx="50" cy="50" r="49" fill={`url(#r${id})`} />
        <SvgText x="50" y="65" fontSize="46" fontFamily={font.numBold} fontWeight="600" fill={dim ? '#8E8C87' : '#FFFFFF'} textAnchor="middle">
          {String(n)}
        </SvgText>
        <Ellipse cx="34" cy="23" rx="19" ry="10.5" fill={`url(#s${id})`} transform="rotate(-32 34 23)" />
        <Circle cx="21" cy="40" r="2.6" fill="#FFFFFF" fillOpacity={dim ? 0.3 : 0.55} />
      </Svg>
    </View>
  );
}

// ───────── 기본 부품 ─────────

export function Card({ style, children }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Segmented({ options, value, onChange, small }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segItem, small && { paddingVertical: 7 }, active && s.segItemActive]}>
            <Text style={[s.segText, small && { fontSize: 12.5 }, active && s.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconButton({ name, onPress, size = 40, color = colors.ink, style, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [s.iconBtn, { width: size, height: size }, pressed && { opacity: 0.6 }, disabled && { opacity: 0.3 }, style]}
    >
      <Icon name={name} size={size * 0.5} color={color} />
    </Pressable>
  );
}

export function Button({ text, onPress, kind = 'primary', style, disabled, icon }) {
  const primary = kind === 'primary';
  const gold = kind === 'gold';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        primary && s.btnPrimary,
        gold && s.btnGold,
        !primary && !gold && s.btnGhost,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.35 },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={18} color={primary ? colors.onInk : colors.ink} stroke={2.3} />}
      <Text style={[s.btnText, primary && { color: colors.onInk }]}>{text}</Text>
    </Pressable>
  );
}

// 안드로이드는 화면 끝까지 그리는 방식이라 키보드가 올라와도 창이 줄지 않는다.
// 시트 안 입력칸이 키보드에 가리지 않도록 키보드 높이를 직접 받아서 띄운다.
export function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setH(e.endCoordinates?.height || 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}

// 시트 창은 네비게이션 바 밑까지 항상 깔리게 고정하고(기기·설정마다 달라지지 않게), 그 높이(insets.bottom)만큼
// 내용을 올린다. 키보드 높이는 네비게이션 바를 뺀 값으로 오므로, 키보드가 떠 있을 땐 둘을 더해서 올린다.
export function Sheet({ visible, title, onClose, children }) {
  const kb = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={s.sheetRoot}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { marginBottom: kb > 0 ? kb + insets.bottom : 0 }]}>
          <View style={s.grab} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <IconButton name="close" size={36} onPress={onClose} color={colors.inkSoft} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <View style={{ paddingBottom: kb > 0 ? 28 : 28 + insets.bottom }}>{children}</View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// message 만 있으면 잠깐 떴다 사라지고, action({ label, onPress })이 있으면 조금 더 오래 떠 있다.
export function Toast({ message, action, onHide }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return undefined;
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(action ? 4200 : 1800),
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => finished && onHide?.());
    return () => anim.stop();
  }, [message, action, opacity, onHide]);

  if (!message) return null;
  return (
    <Animated.View pointerEvents="box-none" style={[s.toast, { opacity, bottom: Math.max(insets.bottom, 12) + 94 }]}>
      <View style={s.toastPill}>
        <Text style={s.toastText}>{message}</Text>
        {action && (
          <Pressable
            hitSlop={10}
            onPress={() => {
              action.onPress();
              onHide?.();
            }}
          >
            <Text style={s.toastAction}>{action.label}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// 스크롤하는 내용이 화면 가장자리(상태바 아래, 메뉴 위)에서 뚝 잘리지 않고 배경색으로 부드럽게 사라지게 한다.
// position: 'top' | 'bottom', offset: 그 가장자리에서 띄울 거리
// 천천히 옅어지는 곡선(처음엔 완전히 덮고, 끝에서는 아주 완만하게 사라진다) — 경계선이 눈에 띄지 않는다
const FADE_STOPS = [
  [0, 1],
  [0.25, 0.86],
  [0.5, 0.55],
  [0.75, 0.2],
  [1, 0],
];
export function Fade({ position = 'top', height = 18, offset = 0, color = colors.bg }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const top = position === 'top';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, [position]: offset, height }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {(top ? FADE_STOPS : [...FADE_STOPS].reverse()).map(([at, a]) => (
              <Stop key={at} offset={top ? at : 1 - at} stopColor={color} stopOpacity={a} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },

  seg: { flexDirection: 'row', backgroundColor: colors.chip, borderRadius: radius.md, padding: 4 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm + 2 },
  segItemActive: { backgroundColor: colors.surface },
  segText: { color: colors.inkSoft, fontFamily: font.semibold, fontSize: 13.5 },
  segTextActive: { color: colors.ink, fontFamily: font.bold },

  iconBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },

  btn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, flexDirection: 'row', gap: 8 },
  btnPrimary: { backgroundColor: colors.ink },
  btnGold: { backgroundColor: colors.gold },
  btnGhost: { backgroundColor: colors.chip },
  btnText: { color: colors.ink, fontFamily: font.bold, fontSize: 15 },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,12,16,0.45)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 6 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 18 },

  toast: { position: 'absolute', left: 24, right: 24, bottom: 110, alignItems: 'center', zIndex: 30, elevation: 30 },
  toastPill: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.ink, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill },
  toastText: { color: '#FFFFFF', fontFamily: font.semibold, fontSize: 13 },
  toastAction: { color: colors.gold, fontFamily: font.bold, fontSize: 13 },
});
