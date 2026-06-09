/**
 * 카탈로그 썸네일 생성 스크립트.
 *
 * public/wedding-snap/catalog/*.jpg(원본, 0.5~1.4MB)를 읽어
 * public/wedding-snap/catalog/thumb/{name}.webp(작은 썸네일)로 저장한다.
 *
 * 목적: 카탈로그 그리드/미리보기 UI 가 풀해상도 원본 대신 썸네일을 서빙해
 * Vercel 대역폭을 크게 줄인다. 원본은 생성(fal) 레퍼런스로 그대로 사용.
 *
 * 런타임이 아니라 빌드/커밋 단계에서 1회 실행해 결과 파일을 커밋한다.
 * Vercel "이미지 최적화"(과금/쿼터)를 쓰지 않으므로 비용·쿼터와 무관하다.
 *
 * 실행: node scripts/generate-catalog-thumbs.mjs
 * 새 카탈로그 jpg 를 추가하면 다시 실행해 thumb 를 갱신/추가하면 된다.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const CATALOG_DIR = path.join(process.cwd(), 'public', 'wedding-snap', 'catalog');
const THUMB_DIR = path.join(CATALOG_DIR, 'thumb');

const WIDTH = 480; // 그리드 썸네일은 ~240px 표시 → 레티나 2x 커버.
const QUALITY = 72;

async function main() {
  if (!fs.existsSync(CATALOG_DIR)) {
    console.error('catalog dir not found:', CATALOG_DIR);
    process.exit(1);
  }
  fs.mkdirSync(THUMB_DIR, { recursive: true });

  const files = fs
    .readdirSync(CATALOG_DIR)
    .filter((f) => /\.(jpe?g|png)$/i.test(f));

  let made = 0;
  let skipped = 0;
  for (const f of files) {
    const name = f.replace(/\.[^.]+$/, '');
    const out = path.join(THUMB_DIR, `${name}.webp`);
    // 원본이 thumb 보다 최신일 때만 재생성 (idempotent).
    try {
      const srcStat = fs.statSync(path.join(CATALOG_DIR, f));
      const outStat = fs.existsSync(out) ? fs.statSync(out) : null;
      if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) {
        skipped++;
        continue;
      }
    } catch {
      // stat 실패 시 그냥 생성 시도.
    }
    await sharp(path.join(CATALOG_DIR, f))
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(out);
    made++;
  }
  console.log(`thumbnails: ${made} generated, ${skipped} up-to-date (total ${files.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
