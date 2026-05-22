/**
 * 카탈로그 항목 가시성 필터 (서버 전용)
 *
 * picker UI (랜딩 페이지의 미리보기 + /wedding-snap/create 의 카탈로그 선택) 양쪽에서
 * "선택했는데 마스터 이미지가 없어 생성 실패" 가 나는 걸 막기 위해 두 단계로 거른다:
 *
 *   1. `hidden: true` 인 항목 — 운영자가 정의는 유지하되 노출만 차단한 항목.
 *   2. `public/<image>` 파일이 실제로 없는 항목 — 정의는 됐지만 마스터 jpg 가
 *      아직 안 올라온 상태. 새 jpg 만 올리면 재배포 시 자동 노출 (정의도
 *      `hidden:true` 만 빼면 끝).
 *
 * `fs` 를 쓰므로 클라이언트 컴포넌트에서 import 하지 말 것. 서버 컴포넌트 /
 * route handler 전용. `SNAP_CATALOG` 자체는 그대로 두므로 mypage 등의 lookup
 * (`findSnapCatalog`) 은 hidden / 파일 유무와 무관하게 계속 동작 — 과거에
 * 생성된 항목의 라벨 표시가 깨지지 않는다.
 */

import fs from 'fs';
import path from 'path';
import { SNAP_CATALOG, type SnapCatalogItem } from './catalog';

/**
 * picker 에 노출 가능한 카탈로그 항목만 반환.
 * - `hidden:true` 인 항목 제외
 * - public/ 하위에 image 파일이 실제로 존재하지 않는 항목 제외
 */
export function getAvailableCatalog(): SnapCatalogItem[] {
  return SNAP_CATALOG.filter((item) => {
    if (item.hidden) return false;
    const rel = item.image.startsWith('/') ? item.image.slice(1) : item.image;
    const abs = path.join(process.cwd(), 'public', rel);
    try {
      return fs.statSync(abs).isFile();
    } catch {
      return false;
    }
  });
}
