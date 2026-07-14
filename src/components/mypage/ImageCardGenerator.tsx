'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  InvitationContentSchema,
  type InvitationContent,
} from '@/types/invitation';
import { CoverCapture } from '@/components/invitation/CoverCapture';

// 출력: 세로 9:16 한 장(1080×1920). 디자인은 ~405px 네이티브(폰 기준 보정값)로
// 렌더한 뒤 html2canvas scale 로 확대 → 고정 px 텍스트/일러스트가 제 비율로 크게.
const BASE_W = 405;
const BASE_H = 720; // 9:16
const OUTPUT_W = 1080;
const CAPTURE_SCALE = OUTPUT_W / BASE_W; // → 1080×1920

const STORAGE_BUCKET = 'public-images';
const storagePath = (invitationId: string) =>
  `invitations/${invitationId}/image-card/9x16.png`;

interface Loaded {
  content: InvitationContent;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
}

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
 * 이미지 알림장 생성 모달.
 *
 * - 현재 저장된 메인 디자인을 세로 9:16 이미지 한 장으로 만든다(중요 요소는
 *   중앙에 오도록 표지 디자인을 그대로 렌더).
 * - 생성 결과는 storage(invitations/{id}/image-card/9x16.png)에 저장 → 다음에
 *   다시 열면 저장본을 바로 다운로드.
 * - "재생성"은 같은 경로에 덮어써(upsert) 이전 파일이 orphan 으로 남지 않는다.
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
  const blobRef = useRef<Blob | null>(null); // 방금 생성한 blob(즉시 다운로드용)

  // 배경 스크롤 잠금.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // content 로드 + 기존 저장본 존재 확인(병렬).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const [invRes, listRes] = await Promise.all([
          fetch(`/api/invitations/${invitationId}`),
          supabase.storage
            .from(STORAGE_BUCKET)
            .list(`invitations/${invitationId}/image-card`, {
              search: '9x16.png',
            }),
        ]);
        if (!invRes.ok) throw new Error(`불러오기 실패 (HTTP ${invRes.status})`);
        const json = await invRes.json();
        const inv = json.invitation;
        const content = InvitationContentSchema.parse(inv.content ?? {});
        if (!alive) return;
        setData({
          content,
          groomName: inv.groom_name ?? '',
          brideName: inv.bride_name ?? '',
          weddingDate: inv.wedding_date ?? null,
        });
        const exists = (listRes.data ?? []).some((f) => f.name === '9x16.png');
        if (exists) {
          const { data: pub } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(storagePath(invitationId));
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
  }, [invitationId]);

  const generate = useCallback(async () => {
    if (!captureRef.current) return;
    setPhase('working');
    setError(null);
    try {
      const html2canvas = (await import('html2canvas')).default;
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 200));
      await waitImages(captureRef.current);

      const canvas = await html2canvas(captureRef.current, {
        useCORS: true,
        backgroundColor: null,
        scale: CAPTURE_SCALE,
        width: BASE_W,
        height: BASE_H,
        imageTimeout: 20000,
        logging: false,
      });
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), 'image/png'),
      );
      if (!blob) throw new Error('이미지 인코딩 실패');
      blobRef.current = blob;

      // 같은 경로에 덮어써(upsert) 이전 파일을 대체 → orphan 없음.
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath(invitationId), blob, {
          contentType: 'image/png',
          upsert: true,
        });
      if (upErr) throw new Error(`저장 실패: ${upErr.message}`);
      const { data: pub } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath(invitationId));
      // 캐시 무효화 — 덮어쓴 새 이미지를 즉시 반영.
      setSavedUrl(`${pub.publicUrl}?v=${Date.now()}`);
      setPhase('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 생성 실패');
      setPhase('error');
    }
  }, [invitationId]);

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
          <h2 className="text-sm font-semibold text-[#3D2E1F]">이미지 알림장</h2>
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

          {/* 미리보기 (저장본이 있으면 표시) */}
          {savedUrl ? (
            <div className="mx-auto w-40">
              <div className="overflow-hidden rounded-lg border border-[#E8DCC9] bg-[#FAF7F2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={savedUrl} alt="이미지 알림장 미리보기" className="w-full" />
              </div>
              <p className="mt-1.5 text-center text-[11px] text-[#8B7355]">
                세로 9:16
              </p>
            </div>
          ) : (
            phase !== 'loading' && (
              <div className="mx-auto grid h-56 w-40 place-items-center rounded-lg border border-dashed border-[#E8DCC9] text-[11px] text-[#B09B80]">
                {busy ? '생성 중…' : '아직 생성 전'}
              </div>
            )
          )}
        </div>

        {/* 액션 */}
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
                  {busy ? '재생성 중…' : '재생성'}
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

      {/* 캡처용 offscreen 렌더 — 네이티브 크기(405×720). html2canvas scale 로 확대. */}
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
