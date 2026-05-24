'use client';

/**
 * 모드별 합성 흐름 예시를 단계별 썸네일 + 화살표로 보여주는 모달.
 *
 * 호출처: SnapGenerator 의 "1. 사진 업로드" 섹션 ModeCard 의 "예시 보기" 버튼.
 * 사용자가 처음 모드를 고를 때 "이런 사진을 넣으면 → 이런 흐름으로 → 이런 결과"
 * 를 한눈에 보여줘 결정 부담을 줄이는 게 목적.
 *
 * 흐름:
 *   셀카 모드 →
 *     row 1: 신랑셀카 → 신랑앵커 → 카탈로그 → 결과 (신랑 단독 컷)
 *     row 2: 신부셀카 → 신부앵커 → 카탈로그 → 결과 (신부 단독 컷)
 *     row 3: 신랑+신부 앵커 → 카탈로그 → 결과 (함께 컷)
 *   커플 모드 →
 *     row 1: 커플사진 → 카탈로그 → 결과 (1번 컷)
 *     row 2: 커플사진 → 카탈로그 → 결과 (2번 컷)
 *
 * 이미지 파일 규약: public/wedding-snap/mode-examples/<...>.jpg (README 참고).
 * 카탈로그 칸은 SNAP_CATALOG 에서 EXAMPLE_CATALOG_IDS 로 지정한 항목의 마스터를
 * 그대로 사용 — admin 이 mode-examples/ 에 카탈로그 사본을 또 올릴 필요 없음.
 * 파일이 없으면 onError → "준비 중" placeholder 로 fallback.
 */

import { useEffect } from 'react';
import { findSnapCatalog } from '@/lib/snap/catalog';

/**
 * 각 row 의 카탈로그 칸에 보일 catalog id.
 * 운영하면서 더 좋은 reference 컷이 있으면 여기만 바꾸면 됨.
 * (모두 active 항목이어야 함 — hidden 인 항목 쓰면 결과 칸이 placeholder 로 빠짐.)
 */
const EXAMPLE_CATALOG_IDS = {
  groomSolo: 'groom-portrait-studio',
  brideSolo: 'bride-floral-bed-seated',
  together: 'studio-couple-blackwhite',
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
  // ESC 로 닫기.
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, onClose]);

  if (!mode) return null;

  const title =
    mode === 'selfies' ? '셀카로 만들기 — 흐름 예시' : '커플 사진으로 만들기 — 흐름 예시';

  return (
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
              ? '신랑·신부 각자 셀카로 만든 앵커를 카탈로그에 합성합니다. 함께 컷 / 신랑 단독 / 신부 단독 컷 모두 가능해요.'
              : '두 사람이 함께 찍힌 커플 사진 1장으로 만듭니다. 포즈·체형·상호작용을 그대로 유지하며 카탈로그의 의상/배경만 바꿔요. (함께 컷만 가능)'}
          </p>

          {mode === 'selfies' ? (
            <>
              <ExampleFlowRow
                title="신랑 단독 컷 만들기"
                steps={[
                  { src: `${MODE_BASE}/selfies-groom-selfie.jpg`, label: '신랑 셀카' },
                  { src: `${MODE_BASE}/selfies-groom-anchor.jpg`, label: '신랑 앵커' },
                  {
                    src: imageForCatalogId(EXAMPLE_CATALOG_IDS.groomSolo),
                    label: '카탈로그',
                  },
                  { src: `${MODE_BASE}/selfies-groom-result.jpg`, label: '결과' },
                ]}
              />
              <ExampleFlowRow
                title="신부 단독 컷 만들기"
                steps={[
                  { src: `${MODE_BASE}/selfies-bride-selfie.jpg`, label: '신부 셀카' },
                  { src: `${MODE_BASE}/selfies-bride-anchor.jpg`, label: '신부 앵커' },
                  {
                    src: imageForCatalogId(EXAMPLE_CATALOG_IDS.brideSolo),
                    label: '카탈로그',
                  },
                  { src: `${MODE_BASE}/selfies-bride-result.jpg`, label: '결과' },
                ]}
              />
              <ExampleFlowRow
                title="함께 컷 만들기"
                steps={[
                  {
                    src: `${MODE_BASE}/selfies-groom-anchor.jpg`,
                    secondarySrc: `${MODE_BASE}/selfies-bride-anchor.jpg`,
                    label: '신랑 + 신부 앵커',
                  },
                  {
                    src: imageForCatalogId(EXAMPLE_CATALOG_IDS.together),
                    label: '카탈로그',
                  },
                  { src: `${MODE_BASE}/selfies-together-result.jpg`, label: '결과' },
                ]}
              />
            </>
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
  );
}

interface FlowStep {
  src: string;
  /** "신랑 + 신부 앵커" 같은 칸에서 두 번째 썸네일을 같이 그릴 때 사용 */
  secondarySrc?: string;
  label: string;
}

function ExampleFlowRow({ title, steps }: { title: string; steps: FlowStep[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#E8DCC9] bg-[#FAF7F2]/40 p-3">
      <p className="text-[12px] font-medium text-[#3D2E1F]">{title}</p>
      <div className="flex items-end gap-1 overflow-x-auto pb-1">
        {steps.map((step, i) => (
          <div key={i} className="flex items-end gap-1">
            <FlowThumb step={step} />
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

function FlowThumb({ step }: { step: FlowStep }) {
  return (
    <div className="flex w-16 shrink-0 flex-col gap-1 sm:w-20">
      <div className="flex gap-0.5">
        <ThumbBox src={step.src} alt={step.label} />
        {step.secondarySrc && <ThumbBox src={step.secondarySrc} alt={`${step.label} (보조)`} />}
      </div>
      <span className="text-center text-[9px] leading-tight text-[#5C4633]">{step.label}</span>
    </div>
  );
}

function ThumbBox({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-[3/4] flex-1 overflow-hidden rounded border border-[#D4C5B0] bg-[#F5EDE0]">
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
        className="absolute inset-0 hidden flex-col items-center justify-center text-center text-[9px] leading-tight text-[#8B7355]"
        style={{ display: 'none' }}
      >
        <span className="opacity-60">준비 중</span>
      </div>
    </div>
  );
}

/** catalog id → image path. catalog 가 hidden / 없으면 placeholder. */
function imageForCatalogId(id: string): string {
  const item = findSnapCatalog(id);
  return item?.image ?? `${MODE_BASE}/missing.jpg`;
}
