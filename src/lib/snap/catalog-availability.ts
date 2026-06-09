/**
 * 카탈로그 항목 가시성 필터 (서버 전용)
 *
 * picker UI (랜딩 페이지의 미리보기 + /wedding-snap/create 의 카탈로그 선택) 양쪽에서
 * "선택했는데 마스터 이미지가 없어 생성 실패" 가 나는 걸 막기 위해 세 단계로 거른다:
 *
 *   1. `hidden: true` 인 항목 — 코드(catalog.ts) 에서 정의는 유지하되 노출만
 *      차단한 항목 (legacy 호환 — 점진적으로 admin 태그로 마이그레이션).
 *   2. `public/<image>` 파일이 실제로 없는 항목 — 마스터 jpg 가 안 올라온 상태.
 *   3. 운영자가 admin 페이지에서 두 input_condition (selfies + couple-fullbody)
 *      모두 'hidden' 태그 설정한 항목 — landing/picker 어디서도 노출 X.
 *      한쪽만 hidden 이면 다른 mode 에서는 보이므로 baseline 에는 노출하고,
 *      picker (SnapGenerator) 의 mode 별 추가 필터에서 처리.
 *
 * `fs` 와 supabase 를 쓰므로 클라이언트 컴포넌트에서 import 하지 말 것. 서버
 * 컴포넌트 / route handler 전용. `SNAP_CATALOG` 자체는 그대로 두므로 mypage
 * 등의 lookup (`findSnapCatalog`) 은 hidden / 파일 유무 / admin 태그와 무관
 * 하게 계속 동작 — 과거에 생성된 항목의 라벨 표시가 깨지지 않는다.
 */

import fs from 'fs';
import path from 'path';
import { SNAP_CATALOG, type SnapCatalogItem } from './catalog';
import {
  fetchAllCatalogTags,
  type CatalogAdminTagMap,
} from './catalog-admin-tags';
import {
  fetchCatalogOrder,
  sortByCatalogOrder,
  type CatalogOrderMap,
} from './catalog-order';

/**
 * picker / landing 에 노출 가능한 카탈로그 항목 반환.
 * - `hidden:true` 인 항목 제외
 * - public/ 에 image 파일이 없는 항목 제외
 * - admin 페이지에서 양쪽 condition (selfies + couple-fullbody) 모두 hidden 인 항목 제외
 *
 * tagMap 을 인자로 받지 않고 내부에서 fetch — caller 가 추가로 fetchAllCatalogTags()
 * 를 호출하면 dedup 되지 않아 두 번 가져오므로 둘 다 필요하면 `getAvailableCatalogWith` 사용.
 */
export async function getAvailableCatalog(): Promise<SnapCatalogItem[]> {
  const [tagMap, orderMap] = await Promise.all([
    fetchAllCatalogTags(),
    fetchCatalogOrder(),
  ]);
  return filterCatalog(tagMap, orderMap);
}

/**
 * tagMap 을 외부에서 받아 사용 — caller 가 tagMap 도 따로 필요할 때.
 * (예: SnapGenerator 가 adminTags props 로 받으려면 page 가 fetchAllCatalogTags
 * 를 한 번만 호출하고 양쪽에서 재사용해야 효율적.)
 * orderMap 을 넘기면 운영자 지정 순서로 정렬, 미지정이면 코드 순서.
 */
export function getAvailableCatalogWith(
  tagMap: CatalogAdminTagMap,
  orderMap?: CatalogOrderMap,
): SnapCatalogItem[] {
  return filterCatalog(tagMap, orderMap);
}

function filterCatalog(
  tagMap: CatalogAdminTagMap,
  orderMap?: CatalogOrderMap,
): SnapCatalogItem[] {
  const filtered = SNAP_CATALOG.filter((item) => {
    // admin: 양쪽 condition 모두 hidden 이면 baseline 에서 제외.
    // (한쪽만 hidden 이면 다른 mode 에서는 보여야 하므로 baseline 에는 노출 —
    //  SnapGenerator 의 mode 별 필터에서 추가 차단.)
    const tags = tagMap[item.id];
    if (
      tags?.selfies === 'hidden' &&
      tags?.['couple-fullbody'] === 'hidden'
    ) {
      return false;
    }
    // 파일 존재 체크 — 마스터 jpg 가 없으면 자동 제외. (모듈 수명 캐시)
    return catalogImageExists(item.image);
  });
  return orderMap ? sortByCatalogOrder(filtered, orderMap) : filtered;
}

/**
 * 카탈로그 마스터 이미지 존재 여부 캐시.
 *
 * public/ 의 카탈로그 jpg 는 빌드(배포) 단위로만 바뀌고 런타임에는 불변
 * (Vercel lambda FS 는 read-only). 기존엔 filterCatalog 가 호출될 때마다
 * 카탈로그 항목 수(~115)만큼 fs.statSync 를 동기 실행해 force-dynamic 인
 * 랜딩/홈 페이지에서 요청당 ~115 블로킹 syscall 이 발생했다. 경로별 결과를
 * 모듈 수명 동안 1회만 statSync 하고 캐시해 이를 제거한다. 결과값/필터 동작은
 * 이전과 동일 (순수 메모이즈).
 */
const imageExistsCache = new Map<string, boolean>();
function catalogImageExists(image: string): boolean {
  const rel = image.startsWith('/') ? image.slice(1) : image;
  const abs = path.join(process.cwd(), 'public', rel);
  const cached = imageExistsCache.get(abs);
  if (cached !== undefined) return cached;
  let exists = false;
  try {
    exists = fs.statSync(abs).isFile();
  } catch {
    exists = false;
  }
  imageExistsCache.set(abs, exists);
  return exists;
}
