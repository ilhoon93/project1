#!/usr/bin/env node
/**
 * 기존 public-images 안의 스냅 PII 파일을 private-uploads 로 이동.
 *
 * 대상 prefix (public-images/wedding-snap/<sub> 안에 있는 것들):
 *   - {userId}/anchor-*.jpg       — 사용자 앵커 결과 (얼굴 reference)
 *   - preprocessed/*               — 선처리된 사용자 사진
 *   - ephemeral/*                  — 임시 fal 통신용 (대부분 만료됨, 정리만)
 *
 * 동작:
 *   1) public-images 안의 wedding-snap/ 하위 객체 listing
 *   2) 위 패턴에 매칭되는 객체만 골라 private-uploads 로 copy + 원본 delete
 *   3) snap_anchors / snap_anchor_history 안의 URL 컬럼이 public 결과를
 *      가리키는 경우 새 signed URL 로 업데이트 (가능한 경우만)
 *
 * 실행:
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/migrate-snap-to-private.mjs --dry-run
 *
 *   --dry-run  : 이동/삭제 안 함, 대상만 출력
 *   --execute  : 실제 이동/삭제 실행
 *   --skip-db  : 파일만 이동, DB URL 갱신 skip (예전 URL 들은 broken 됨)
 *
 * 안전:
 *   - 멱등성: 이미 옮겨진 파일 (같은 path 가 private-uploads 에 있음) 은 skip.
 *   - 트랜잭션 없음 — 중간 실패 시 일부 이동 / 일부 미이동 상태 가능.
 *     재실행하면 멱등성으로 안전.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 가 필요합니다');
  process.exit(1);
}
const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--execute');
const skipDb = args.has('--skip-db');

const admin = createClient(url, key, { auth: { persistSession: false } });

/** 한 객체 이동: public-images → private-uploads. 멱등성 보장. */
async function moveOne(srcPath) {
  // 1) private-uploads 에 이미 있는지 확인.
  const { data: existing } = await admin.storage
    .from('private-uploads')
    .list(srcPath.split('/').slice(0, -1).join('/'), {
      search: srcPath.split('/').slice(-1)[0],
      limit: 1,
    });
  if (existing && existing.some((o) => o.name === srcPath.split('/').slice(-1)[0])) {
    return { status: 'skipped_already_exists', path: srcPath };
  }

  // 2) public-images 에서 다운로드.
  const { data: blob, error: dlErr } = await admin.storage
    .from('public-images')
    .download(srcPath);
  if (dlErr || !blob) return { status: 'error_download', path: srcPath, error: dlErr };

  if (dryRun) return { status: 'dry_run_would_move', path: srcPath };

  // 3) private-uploads 에 업로드.
  const arrayBuf = await blob.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from('private-uploads')
    .upload(srcPath, Buffer.from(arrayBuf), {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });
  if (upErr) return { status: 'error_upload', path: srcPath, error: upErr };

  // 4) public-images 에서 삭제.
  const { error: rmErr } = await admin.storage
    .from('public-images')
    .remove([srcPath]);
  if (rmErr) return { status: 'moved_but_delete_failed', path: srcPath, error: rmErr };

  return { status: 'moved', path: srcPath };
}

/** wedding-snap/ 하위 모든 객체 listing (재귀). */
async function listAllSnapObjects() {
  // Supabase storage list 는 단일 폴더만 — 재귀로 직접 순회.
  const queue = ['wedding-snap'];
  const results = [];
  while (queue.length > 0) {
    const prefix = queue.shift();
    const { data, error } = await admin.storage
      .from('public-images')
      .list(prefix, { limit: 1000 });
    if (error) {
      console.warn(`list ${prefix} failed`, error);
      continue;
    }
    for (const entry of data ?? []) {
      // 폴더면 metadata 없음, 파일이면 metadata 있음 (Supabase 동작 기준).
      const full = `${prefix}/${entry.name}`;
      if (!entry.metadata) {
        queue.push(full);
      } else {
        results.push(full);
      }
    }
  }
  return results;
}

function shouldMigrate(path) {
  // path 패턴 예:
  //   wedding-snap/{userId}/anchor-{slot}-{ts}.jpg                  → 이동
  //   wedding-snap/preprocessed/...                                 → 이동
  //   wedding-snap/ephemeral/...                                    → 이동 (ephemeral 은 짧은 수명)
  //   wedding-snap/catalog-blurred/...                              → 유지 (PII 없음)
  //   wedding-snap/{userId}/{catalogId}-{ts}.jpg (결과)              → 유지 (결과 이미지 public)
  const parts = path.split('/');
  if (parts[0] !== 'wedding-snap') return false;
  if (parts[1] === 'catalog-blurred') return false;
  if (parts[1] === 'preprocessed') return true;
  if (parts[1] === 'ephemeral') return true;
  // {userId}/ 하위는 anchor- 만 이동. 결과 이미지(다른 prefix) 는 유지.
  if (parts.length >= 3 && /^[0-9a-f-]{36}$/i.test(parts[1])) {
    return parts[2].startsWith('anchor-');
  }
  return false;
}

/** snap_anchors / snap_anchor_history 에서 옮긴 anchor URL 들을 signed URL 로 재발급. */
async function updateAnchorUrls(movedPaths) {
  if (skipDb) {
    console.log('--skip-db: anchor URL 갱신 skip. 기존 URL 은 broken 될 수 있음.');
    return;
  }
  const movedSet = new Set(movedPaths);
  const tables = [
    { name: 'snap_anchors', cols: ['groom_anchor_url', 'bride_anchor_url'] },
    {
      name: 'snap_anchor_history',
      cols: ['groom_anchor_url', 'bride_anchor_url'],
    },
  ];
  for (const t of tables) {
    const { data: rows } = await admin
      .from(t.name)
      .select(`id, ${t.cols.join(', ')}`);
    if (!rows) continue;
    for (const row of rows) {
      const patch = {};
      for (const col of t.cols) {
        const u = row[col];
        if (!u) continue;
        // public-images URL 에서 path 추출.
        const m = u.match(/\/storage\/v1\/object\/public\/public-images\/(.+?)(?:\?|$)/);
        if (!m) continue;
        const path = m[1];
        if (!movedSet.has(path)) continue;
        // 새 signed URL 발급 (1년).
        const { data: signed } = await admin.storage
          .from('private-uploads')
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) patch[col] = signed.signedUrl;
      }
      if (Object.keys(patch).length > 0) {
        if (dryRun) {
          console.log(`[dry-run] ${t.name} ${row.id}: ${Object.keys(patch).join(', ')}`);
        } else {
          const { error } = await admin.from(t.name).update(patch).eq('id', row.id);
          if (error) console.warn(`update ${t.name} ${row.id} failed`, error);
          else console.log(`updated ${t.name} ${row.id}: ${Object.keys(patch).join(', ')}`);
        }
      }
    }
  }
}

async function main() {
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'} (--execute 로 실제 실행)`);
  const all = await listAllSnapObjects();
  const targets = all.filter(shouldMigrate);
  console.log(`총 ${all.length} 객체 중 ${targets.length} 개가 이동 대상.`);

  const stats = {
    moved: 0,
    skipped_already_exists: 0,
    dry_run_would_move: 0,
    error_download: 0,
    error_upload: 0,
    moved_but_delete_failed: 0,
  };
  const moved = [];
  for (const p of targets) {
    const r = await moveOne(p);
    stats[r.status] = (stats[r.status] ?? 0) + 1;
    if (r.status === 'moved' || r.status === 'moved_but_delete_failed') moved.push(p);
    if (r.status.startsWith('error')) console.warn(r);
  }
  console.log('통계:', stats);

  if (!dryRun) {
    await updateAnchorUrls(moved);
  } else {
    console.log('(dry-run) DB URL 갱신 시뮬레이션:');
    await updateAnchorUrls(targets);
  }
}

main().catch((e) => {
  console.error('fatal', e);
  process.exit(1);
});
