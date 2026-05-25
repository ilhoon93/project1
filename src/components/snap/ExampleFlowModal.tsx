'use client';

/**
 * 모드별 합성 흐름 예시를 보여주는 모달.
 *
 * 호출처: SnapGenerator 의 "1. 사진 업로드" 섹션 ModeCard 의 "예시 보기" 버튼.
 *
 * 흐름:
 *   셀카 모드 →
 *     "이런 셀카 3장을 올리면 돼요" — 정면 / 좌 45° / 우 45° 셀카 3장 표시.
 *     사용자가 처음 모드를 선택할 때 가장 궁금한 "입력 사진 형태" 를 단순 시각화.
 *   커플 모드 →
 *     row 1: 커플사진 → 카탈로그 → 결과 (예시 1)
 *     row 2: 커플사진 → 카탈로그 → 결과 (예시 2)
 *
 * 이미지 파일 규약: public/wedding-snap/mode-examples/<...>.jpg (README 참고).
 * 카탈로그 칸은 SNAP_CATALOG 에서 EXAMPLE_CATALOG_IDS 로 지정한 항목의 마스터를
 * 그대로 사용 — admin 이 mode-examples/ 에 카탈로그 사본을 또 올릴 필요 없음.
 * 파일이 없으면 onError → "준비 중" placeholder 로 fallback.
 *
 * 모든 썸네일은 클릭 시 lightbox 로 확대 (ESC / 외부 클릭 / × 로 닫기).
 */

import { useEffect, useState } from 'react';
import { findSnapCatalog } from '@/lib/snap/catalog';

/**
 * 각 row 의 카탈로그 칸에 보일 catalog id.
 * 운영하면서 더 좋은 reference 컷이 있으면 여기만 바꾸면 됨.
 * (모두 active 항목이어야 함 — hidden 인 항목 쓰면 결과 칸이 placeholder 로 빠짐.)
 */
const EXAMPLE_CATALOG_IDS = {
  couple1: 'beach-classic-white',
  couple2: 'paris-eiffel-walk',
} as const;

const MODE_BASE = '/wedding-snap/mode-examples';

export type ExampleFlowMode = 'selfies' | 'couple';

export function ExampleFlowModal({
  mode,
  onClose,
}: {
  mode: ExampleFlowMode | null;
  onClose: () => void;
}) {
  // lightbox state — 어떤 썸네일을 클릭했는지 src 만 저장.
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // ESC 로 닫기 (lightbox 가 열려 있으면 lightbox 먼저, 아니면 모달).
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (lightboxSrc) setLightboxSrc(null);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, onClose, lightboxSrc]);

  // 모달이 닫히면 lightbox 도 같이 정리.
  useEffect(() => {
    if (!mode) setLightboxSrc(null);
  }, [mode]);

  if (!mode) return null;

  const title =
    mode === 'selfies'
      ? '셀카로 만들기 — 입력 셀카 예시'
      : '커플 사진으로 만들기 — 흐름 예시';

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-baseline justify-between border-b border-[#E8DCC9] px-5 py-3">
            <h3 className="text-sm font-semibold text-[#3D2E1F]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="text-[#8B7355] hover:text-[#3D2E1F]"
            >
              ✕
            </button>
          </div>

          {/* 본문 */}
          <div className="flex flex-col gap-5 px-5 py-4">
            <p className="text-[11px] leading-relaxed text-[#5C4633]">
              {mode === 'selfies'
                ? '신랑·신부 각자 아래와 같은 정면 / 좌 45° / 우 45° 셀카 3장씩 준비해 주세요. 사진을 누르면 크게 볼 수 있어요.'
                : '두 사람이 함께 찍힌 커플 사진 1장으로 만듭니다. 포즈·체형·상호작용을 그대로 유지하며 카탈로그의 의상/배경만 바꿔요. (함께 컷만 가능)'}
            </p>

            {mode === 'selfies' ? (
              <SelfieAnglesRow onPick={setLightboxSrc} />
            ) : (
              <>
                <ExampleFlowRow
                  title="예시 1"
                  steps={[
                    { src: `${MODE_BASE}/couple-input.jpg`, label: '커플 사진' },
                    {
                      src: imageForCatalogId(EXAMPLE_CATALOG_IDS.couple1),
                      label: '카탈로그',
                    },
                    { src: `${MODE_BASE}/couple-result-1.jpg`, label: '결과' },
                  ]}
                  onPick={setLightboxSrc}
                />
                <ExampleFlowRow
                  title="예시 2"
                  steps={[
                    { src: `${MODE_BASE}/couple-input.jpg`, label: '커플 사진' },
                    {
                      src: imageForCatalogId(EXAMPLE_CATALOG_IDS.couple2),
                      label: '카탈로그',
                    },
                    { src: `${MODE_BASE}/couple-result-2.jpg`, label: '결과' },
                  ]}
                  onPick={setLightboxSrc}
                />
              </>
            )}
          </div>

          {/* 하단 닫기 */}
          <div className="flex justify-end border-t border-[#E8DCC9] px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-[#3D2E1F] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#5C4633]"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* lightbox — 클릭한 썸네일을 화면 가득 확대. 클릭 또는 ✕ 로 닫기. */}
      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="이미지 크게 보기"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxSrc(null);
            }}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xl text-white hover:bg-white/30"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt=""
            className="block max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/** 셀카 모드 — 정면 / 좌 / 우 3장을 한 줄로 표시. 클릭 시 lightbox. */
function SelfieAnglesRow({ onPick }: { onPick: (src: string) => void }) {
  const angles: Array<{ src: string; label: string }> = [
    { src: `${MODE_BASE}/selfies-front.jpg`, label: '정면' },
    { src: `${MODE_BASE}/selfies-left.jpg`, label: '좌 45°' },
    { src: `${MODE_BASE}/selfies-right.jpg`, label: '우 45°' },
  ];
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#E8DCC9] bg-[#FAF7F2]/40 p-3">
      <p className="text-[12px] font-medium text-[#3D2E1F]">셀카 3장 (3장씩 모드 기준)</p>
      <div className="grid grid-cols-3 gap-2">
        {angles.map((angle) => (
          <FlowThumb
            key={angle.src}
            step={{ src: angle.src, label: angle.label }}
            size="lg"
            onPick={onPick}
          />
        ))}
      </div>
      <p className="text-[10px] leading-snug text-[#8B7355]">
        ※ 1장씩 모드는 정면 1장만 올리시면 됩니다.
      </p>
    </div>
  );
}

interface FlowStep {
  src: string;
  /** "신랑 + 신부 앵커" 같은 칸에서 두 번째 썸네일을 같이 그릴 때 사용 */
  secondarySrc?: string;
  label: string;
}

function ExampleFlowRow({
  title,
  steps,
  onPick,
}: {
  title: string;
  steps: FlowStep[];
  onPick: (src: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#E8DCC9] bg-[#FAF7F2]/40 p-3">
      <p className="text-[12px] font-medium text-[#3D2E1F]">{title}</p>
      <div className="flex items-end gap-1 overflow-x-auto pb-1">
        {steps.map((step, i) => (
          <div key={i} className="flex items-end gap-1">
            <FlowThumb step={step} onPick={onPick} />
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className="mx-0.5 self-center text-base font-light text-[#8B7355]"
              >
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowThumb({
  step,
  size = 'sm',
  onPick,
}: {
  step: FlowStep;
  size?: 'sm' | 'lg';
  onPick: (src: string) => void;
}) {
  const widthClass = size === 'lg' ? 'w-full' : 'w-16 shrink-0 sm:w-20';
  return (
    <div className={`flex ${widthClass} flex-col gap-1`}>
      <div className="flex gap-0.5">
        <ThumbBox src={step.src} alt={step.label} onPick={onPick} />
        {step.secondarySrc && (
          <ThumbBox
            src={step.secondarySrc}
            alt={`${step.label} (보조)`}
            onPick={onPick}
          />
        )}
      </div>
      <span className="text-center text-[10px] leading-tight text-[#5C4633]">
        {step.label}
      </span>
    </div>
  );
}

function ThumbBox({
  src,
  alt,
  onPick,
}: {
  src: string;
  alt: string;
  onPick: (src: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(src)}
      className="relative aspect-[3/4] flex-1 overflow-hidden rounded border border-[#D4C5B0] bg-[#F5EDE0] transition-transform hover:scale-[1.02]"
      title="크게 보기"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block h-full w-full object-cover"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = 'none';
          const fb = target.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = 'flex';
        }}
      />
      <div
        className="absolute inset-0 hidden flex-col items-center justify-center text-center text-[10px] leading-tight text-[#8B7355]"
        style={{ display: 'none' }}
      >
        <span className="opacity-60">준비 중</span>
      </div>
    </button>
  );
}

/** catalog id → image path. catalog 가 hidden / 없으면 placeholder. */
function imageForCatalogId(id: string): string {
  const item = findSnapCatalog(id);
  return item?.image ?? `${MODE_BASE}/missing.jpg`;
}
