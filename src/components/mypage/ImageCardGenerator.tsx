'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  InvitationContentSchema,
  type InvitationContent,
} from '@/types/invitation';
import { CoverCapture } from '@/components/invitation/CoverCapture';

/** 저장 이미지 규격 — 인스타그램(4:5) / 카카오톡 프로필(9:16). */
const FORMATS = [
  { key: 'instagram', label: '인스타그램', ratio: '4:5', width: 1080, height: 1350 },
  { key: 'kakao', label: '카카오톡 프로필', ratio: '9:16', width: 1080, height: 1920 },
] as const;

type FormatKey = (typeof FORMATS)[number]['key'];

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
 * 이미지 알림장 생성 모달 — 표지 디자인을 인스타/카톡 규격 이미지로 저장.
 *
 * 현재 저장된 메인 디자인 기준으로 서버에서 content 를 받아, 화면 밖(offscreen)에
 * 목표 픽셀 크기로 표지를 렌더한 뒤 html2canvas 로 캡처해 PNG 로 다운로드한다.
 */
export function ImageCardGenerator({
  invitationId,
  onClose,
}: {
  invitationId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<FormatKey, string>>>({});
  const [status, setStatus] = useState<'loading' | 'rendering' | 'ready' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const captureRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 배경 스크롤 잠금.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 1) content 로드.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/invitations/${invitationId}`);
        if (!res.ok) throw new Error(`불러오기 실패 (HTTP ${res.status})`);
        const json = await res.json();
        const inv = json.invitation;
        const content = InvitationContentSchema.parse(inv.content ?? {});
        if (!alive) return;
        setData({
          content,
          groomName: inv.groom_name ?? '',
          brideName: inv.bride_name ?? '',
          weddingDate: inv.wedding_date ?? null,
        });
        setStatus('rendering');
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setStatus('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [invitationId]);

  // 2) offscreen 렌더 후 캡처.
  const captureAll = useCallback(async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      if (document.fonts?.ready) await document.fonts.ready;
      // 레이아웃/폰트/이미지 안정화 대기.
      await new Promise((r) => setTimeout(r, 200));
      const out: Partial<Record<FormatKey, string>> = {};
      for (const f of FORMATS) {
        const el = captureRefs.current[f.key];
        if (!el) continue;
        await waitImages(el);
        const canvas = await html2canvas(el, {
          useCORS: true,
          backgroundColor: null,
          scale: 1,
          width: f.width,
          height: f.height,
          imageTimeout: 20000,
          logging: false,
        });
        out[f.key] = canvas.toDataURL('image/png');
      }
      setPreviews(out);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 생성 실패');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (status === 'rendering' && data) void captureAll();
  }, [status, data, captureAll]);

  const download = (key: FormatKey) => {
    const url = previews[key];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `wooridaun-${key}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
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
            현재 저장된 <strong className="text-[#3D2E1F]">메인 디자인</strong> 기준으로
            생성됩니다. 인스타그램·카카오톡 프로필에 올리기 좋은 두 가지 비율로
            제공돼요.
          </p>

          {status === 'error' && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error ?? '오류가 발생했어요.'} 잠시 후 다시 시도해주세요.
            </p>
          )}

          {(status === 'loading' || status === 'rendering') && (
            <p className="py-6 text-center text-xs text-[#8B7355]">이미지 생성 중…</p>
          )}

          {status === 'ready' && (
            <div className="grid grid-cols-2 gap-3">
              {FORMATS.map((f) => (
                <div key={f.key} className="flex flex-col gap-2">
                  <div className="overflow-hidden rounded-lg border border-[#E8DCC9] bg-[#FAF7F2]">
                    {previews[f.key] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previews[f.key]}
                        alt={`${f.label} 미리보기`}
                        className="w-full"
                      />
                    ) : (
                      <div className="grid aspect-[3/4] place-items-center text-[10px] text-[#B09B80]">
                        생성 실패
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[11px] text-[#8B7355]">
                    {f.label} · {f.ratio}
                  </div>
                  <button
                    type="button"
                    onClick={() => download(f.key)}
                    disabled={!previews[f.key]}
                    className="rounded-md bg-[#3D2E1F] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-40"
                  >
                    다운로드
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 캡처용 offscreen 렌더 — 실제 목표 픽셀 크기. */}
      {data && (
        <div
          aria-hidden
          style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}
        >
          {FORMATS.map((f) => (
            <CoverCapture
              key={f.key}
              ref={(el) => {
                captureRefs.current[f.key] = el;
              }}
              content={data.content}
              groomName={data.groomName}
              brideName={data.brideName}
              weddingDate={data.weddingDate}
              width={f.width}
              height={f.height}
            />
          ))}
        </div>
      )}
    </div>
  );
}
