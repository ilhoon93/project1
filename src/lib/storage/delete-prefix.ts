import type { SupabaseClient } from '@supabase/supabase-js';

type StorageApi = SupabaseClient['storage'];

/**
 * 주어진 bucket 의 prefix 아래 모든 객체를 삭제한다. Supabase Storage 는 list 가
 * 한 단계만 보여주므로 폴더(Supabase 관행상 entry.id === null)를 만나면 재귀한다.
 * 이 앱의 이미지 깊이는 얕다(invitations/{id}/gallery/file.jpg, wedding-snap/{uid}/...).
 *
 * 최선 노력(best-effort) — 실패해도 throw 하지 않는다. 호출측이 DB 삭제 등 다음
 * 단계를 계속 진행할 수 있게 한다(스토리지 잔여물은 치명적이지 않음).
 */
export async function deleteStoragePrefix(
  storage: StorageApi,
  bucket: string,
  prefix: string,
): Promise<void> {
  try {
    const { data: entries } = await storage.from(bucket).list(prefix, { limit: 1000 });
    if (!entries || entries.length === 0) return;

    const fileKeys: string[] = [];
    for (const entry of entries) {
      if (entry.id === null) {
        // 폴더 → 재귀.
        await deleteStoragePrefix(storage, bucket, `${prefix}/${entry.name}`);
      } else {
        fileKeys.push(`${prefix}/${entry.name}`);
      }
    }
    if (fileKeys.length > 0) await storage.from(bucket).remove(fileKeys);
  } catch {
    // best-effort — 무시.
  }
}
