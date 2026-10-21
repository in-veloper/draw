// assets/icon-source.png(크림빛 둥근 사각형 안의 D 로고)에서 앱 아이콘 일체를 만든다.
// 원본 아래쪽의 "DRAW" 글자는 지우고(배경 색을 위·아래 행에서 이어 붙여 메움) 로고만 쓴다.
// 사용: node scripts/make-icon.js
const path = require('path');
const sharp = require('C:/ClaudeCode_Project/studyplan/node_modules/sharp');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = path.join(ASSETS, 'icon-source.png');

// 글자가 있는 띠(y)와 좌우(x) — 이 안을 위·아래 행에서 보간해 지운다
const ERASE = { x0: 320, x1: 945, y0: 846, y1: 968 };
// 로고(D)가 가운데 오도록 둥근 사각형 안쪽을 정사각형으로 자른다
const CROP = { left: 313, top: 220, width: 640, height: 640 }; // D 는 왼쪽이 평평해 눈에는 왼쪽으로 쏠려 보여서, 기하학적 중심보다 오른쪽으로 22px 옮긴다
const CREAM = { r: 249, g: 243, b: 233 };
const S = 1024;

async function save(img, name) {
  await img.png().toFile(path.join(ASSETS, name));
  console.log('wrote', name);
}

async function cleanedSource() {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const px = (x, y, c) => data[(y * info.width + x) * ch + c];
  for (let x = ERASE.x0; x <= ERASE.x1; x += 1) {
    for (let y = ERASE.y0 + 1; y < ERASE.y1; y += 1) {
      const t = (y - ERASE.y0) / (ERASE.y1 - ERASE.y0);
      for (let c = 0; c < ch; c += 1) {
        data[(y * info.width + x) * ch + c] = Math.round(px(x, ERASE.y0, c) * (1 - t) + px(x, ERASE.y1, c) * t);
      }
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer();
}

(async () => {
  const clean = await cleanedSource();
  await sharp(clean).toFile(path.join(ASSETS, 'icon-clean.png'));
  const crop = await sharp(clean).extract(CROP).png().toBuffer();

  // 1) 일반 아이콘: 잘라 낸 그림 그대로(시스템이 모양 마스크를 씌운다)
  await save(sharp(crop).resize(S, S), 'icon.png');
  await save(sharp(crop).resize(96, 96), 'favicon.png');

  // 2) 어댑티브 아이콘: 가운데 66% 안전 영역에 로고가 들어가도록 그림을 줄여서 얹는다.
  const size = 600;
  const off = Math.round((S - size) / 2);

  const feather = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect x="24" y="24" width="${size - 48}" height="${size - 48}" rx="48" fill="#fff"/></svg>`
  );
  const mask = await sharp(feather).blur(11).extractChannel(0).toBuffer();
  const fg = await sharp(crop).resize(size, size).ensureAlpha().joinChannel(mask).png().toBuffer();

  await save(
    sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fg, left: off, top: off }]),
    'android-icon-foreground.png'
  );

  // 배경 층: 같은 그림에서 로고를 크림색으로 덮고 크게 흐려서, 가장자리 색감이 그림과 이어지게 한다
  // (sharp 는 합성을 맨 마지막에 하므로, 덮는 단계를 먼저 따로 끝낸다)
  const cover = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect x="40" y="40" width="560" height="560" rx="110" fill="rgb(${CREAM.r},${CREAM.g},${CREAM.b})"/></svg>`
  );
  const covered = await sharp(crop).composite([{ input: cover }]).png().toBuffer();
  await save(sharp(covered).blur(46).resize(S, S), 'android-icon-background.png');

  // 3) 단색 테마용(안드로이드 13 "테마 아이콘"): 남색 로고만 흰색으로 뽑는다
  const { data, info } = await sharp(crop).resize(size, size).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const r = data[i * info.channels];
    const g = data[i * info.channels + 1];
    const b = data[i * info.channels + 2];
    const navy = b > r + 22 && r + g + b < 430;
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = navy ? Math.min(255, (430 - (r + g + b)) * 2.2) : 0;
  }
  const mono = await sharp(out, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
  await save(
    sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: mono, left: off, top: off }]),
    'android-icon-monochrome.png'
  );

  // 4) 스플래시: 크림 바탕(#F9F3E9) 위에 로고
  await save(
    sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fg, left: off, top: off }]),
    'splash-icon.png'
  );
})();
