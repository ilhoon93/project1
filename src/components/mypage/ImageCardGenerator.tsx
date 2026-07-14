'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toCanvas } from 'html-to-image';
import { createClient } from '@/lib/supabase/client';
import {
  InvitationContentSchema,
  type InvitationContent,
} from '@/types/invitation';
import { CoverCapture } from '@/components/invitation/CoverCapture';

// 표지는 실제 메인 디자인과 동일하게 9:18(폰) 비율로 네이티브 렌더하고, 출력은
// 세로 9:16 으로 위·아래를 잘라낸다(사진은 잘려도 프레임/구성 비율은 그대로 유지).
const BASE_W = 405;
const BASE_H = 810; // 9:18 (실제 메인 표지 비율)
const OUTPUT_W = 1080;
const OUTPUT_H = 1920; // 9:16
const PIXEL_RATIO = OUTPUT_W / BASE_W; // 네이티브 → 고해상도

const STORAGE_BUCKET = 'public-images';
const folderPath = (invitationId: string) =>
  `invitations/${invitationId}/image-card`;

interface Loaded {
  content: InvitationContent;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
}

/** el 하위 img 들이 모두 로드될 때까지 대기(캡처 전 안정화). */
async function waitImages(el: HTMLElement): Promise<void> {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          }),
    ),
  );
}

/**
 * 알림장 이미지 생성 모달.
 *
 * - 현재 저장된 메인 디자인을 실제 표지와 동일하게 렌더(html-to-image = 브라우저
 *   네이티브 렌더라 하트 clip-path·스크린 aspect-ratio·필터가 그대로 재현)한 뒤
 *   세로 9:16 로 잘라 한 장의 PNG 로 저장한다.
 * - 결과는 storage 에 매번 고유 파일명으로 저장하고 이전 파일은 삭제 → 새 URL 이라
 *   CDN 캐시로 옛 이미지가 남지 않고, orphan 리소스도 남지 않는다.
 * - 재생성은 content 를 다시 불러오고(cache:'no-store') 이미지도 cacheBust 로 새로
 *   받아 편집 내용이 즉시 반영된다.
 */
export function ImageCardGenerator({
  invitationId,
  onClose,
}: {
  invitationId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'idle' | 'working' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // content 로드(no-store) + 기존 저장본 확인.
  const loadContent = useCallback(async (): Promise<Loaded> => {
    const res = await fetch(`/api/invitations/${invitationId}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`불러오기 실패 (HTTP ${res.status})`);
    const json = await res.json();
    const inv = json.invitation;
    return {
      content: InvitationContentSchema.parse(inv.content ?? {}),
      groomName: inv.groom_name ?? '',
      brideName: inv.bride_name ?? '',
      weddingDate: inv.wedding_date ?? null,
    };
  }, [invitationId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const [loaded, listRes] = await Promise.all([
          loadContent(),
          supabase.storage.from(STORAGE_BUCKET).list(folderPath(invitationId)),
        ]);
        if (!alive) return;
        setData(loaded);
        const latest = (listRes.data ?? [])
          .filter((f) => f.name.endsWith('.png'))
          .sort((a, b) => b.name.localeCompare(a.name))[0];
        if (latest) {
          const { data: pub } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(`${folderPath(invitationId)}/${latest.name}`);
          setSavedUrl(pub.publicUrl);
        }
        setPhase('idle');
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [invitationId, loadContent]);

  const generate = useCallback(async () => {
    setPhase('working');
    setError(null);
    try {
      // 최신 저장 디자인으로 재-렌더 (편집 후 즉시 반영).
      const fresh = await loadContent();
      setData(fresh);
      // CoverCapture 가 새 content 로 리렌더될 시간 + 폰트/이미지 안정화 대기.
      await new Promise((r) => setTimeout(r, 250));
      if (document.fonts?.ready) await document.fonts.ready;
      const el = captureRef.current;
      if (!el) throw new Error('렌더 준비 실패');
      await waitImages(el);

      // 네이티브 9:18 렌더 → 고해상도 캔버스(cacheBust 로 옛 사진 캐시 우회).
      const srcCanvas = await toCanvas(el, {
        pixelRatio: PIXEL_RATIO,
        cacheBust: true,
        width: BASE_W,
        height: BASE_H,
      });

      // 9:16 으로 중앙 크롭(위·아래 잘라냄, 비율 유지).
      const out = document.createElement('canvas');
      out.width = OUTPUT_W;
      out.height = OUTPUT_H;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('캔버스 생성 실패');
      const sy = Math.max(0, Math.round((srcCanvas.height - OUTPUT_H) / 2));
      ctx.drawImage(srcCanvas, 0, sy, OUTPUT_W, OUTPUT_H, 0, 0, OUTPUT_W, OUTPUT_H);

      const blob: Blob | null = await new Promise((res) =>
        out.toBlob((b) => res(b), 'image/png'),
      );
      if (!blob) throw new Error('이미지 인코딩 실패');
      blobRef.current = blob;

      // 이전 파일 삭제(orphan·캐시 방지) 후 고유 파일명으로 업로드.
      const supabase = createClient();
      const folder = folderPath(invitationId);
      const { data: existing } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(folder);
      if (existing && existing.length > 0) {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(existing.map((f) => `${folder}/${f.name}`));
      }
      const path = `${folder}/cover-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, blob, { contentType: 'image/png', upsert: false });
      if (upErr) throw new Error(`저장 실패: ${upErr.message}`);
      const { data: pub } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);
      setSavedUrl(pub.publicUrl);
      setPhase('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 생성 실패');
      setPhase('error');
    }
  }, [invitationId, loadContent]);

  const download = useCallback(async () => {
    try {
      let blob = blobRef.current;
      if (!blob && savedUrl) {
        const res = await fetch(savedUrl, { cache: 'no-store' });
        blob = await res.blob();
      }
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wooridaun-${invitationId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('다운로드에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  }, [invitationId, savedUrl]);

  const busy = phase === 'working';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[#E8DCC9] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#3D2E1F]">알림장 이미지</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-1 text-[#8B7355] hover:bg-[#FAF7F2]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-4 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-2.5 text-[11.5px] leading-relaxed text-[#8B7355]">
            현재 저장된 <strong className="text-[#3D2E1F]">메인 디자인</strong> 기준
            세로 이미지(9:16) 한 장으로 만들어집니다. 디자인을 바꾸려면 에디터에서
            수정 후 <strong className="text-[#3D2E1F]">재생성</strong>해주세요.
          </p>

          {error && (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </p>
          )}

          {phase === 'loading' && (
            <p className="py-8 text-center text-xs text-[#8B7355]">불러오는 중…</p>
          )}

          {savedUrl ? (
            <div className="mx-auto w-40">
              <div className="overflow-hidden rounded-lg border border-[#E8DCC9] bg-[#FAF7F2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={savedUrl} alt="알림장 이미지 미리보기" className="w-full" />
              </div>
              <p className="mt-1.5 text-center text-[11px] text-[#8B7355]">세로 9:16</p>
            </div>
          ) : (
            phase !== 'loading' && (
              <div className="mx-auto grid h-56 w-40 place-items-center rounded-lg border border-dashed border-[#E8DCC9] text-[11px] text-[#B09B80]">
                {busy ? '생성 중…' : '아직 생성 전'}
              </div>
            )
          )}
        </div>

        {phase !== 'loading' && (
          <div className="flex gap-2 border-t border-[#E8DCC9] p-3">
            {savedUrl ? (
              <>
                <button
                  type="button"
                  onClick={download}
                  disabled={busy}
                  className="flex-1 rounded-md bg-[#3D2E1F] px-3 py-2.5 text-[13px] font-medium text-white disabled:opacity-40"
                >
                  다운로드
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy}
                  className="flex-1 rounded-md border border-[#8B7355] px-3 py-2.5 text-[13px] font-medium text-[#8B7355] disabled:opacity-40"
                >
                  {busy ? '재생성 중…' : '최신 디자인으로 재생성'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={generate}
                disabled={busy || !data}
                className="flex-1 rounded-md bg-[#3D2E1F] px-3 py-2.5 text-[13px] font-medium text-white disabled:opacity-40"
              >
                {busy ? '생성 중…' : '이미지 생성하기'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 캡처용 offscreen 렌더 — 네이티브 9:18. html-to-image 로 캡처 후 9:16 크롭. */}
      {data && (
        <div
          aria-hidden
          style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}
        >
          <CoverCapture
            ref={captureRef}
            content={data.content}
            groomName={data.groomName}
            brideName={data.brideName}
            weddingDate={data.weddingDate}
            width={BASE_W}
            height={BASE_H}
          />
        </div>
      )}
    </div>
  );
}
