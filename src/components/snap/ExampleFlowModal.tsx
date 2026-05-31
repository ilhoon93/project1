'use client';

/**
 * 모드별 합성 흐름 예시 모달.
 *
 * 호출처: SnapGenerator 의 "1. 사진 업로드" 섹션 ModeCard 의 "예시 보기" 버튼.
 *
 * 흐름:
 *   셀카 모드 → 3 row (신랑/신부/함께):
 *     row 1: [신랑셀카 3장] → [신랑앵커] → [카탈로그] → [결과 (기본 모드)]
 *     row 2: [신부셀카 3장] → [신부앵커] → [카탈로그] → [결과 (기본 모드)]
 *     row 3: [신랑앵커 + 신부앵커] → [카탈로그] → [결과 (기본 모드)]
 *
 *   커플 모드 → 2 row (input 별 2 카탈로그):
 *     row 1: [커플사진 1] → [카탈로그 A] → [결과 A (기본)] → [카탈로그 B] → [결과 B (얼굴 강화)]
 *     row 2: [커플사진 2] → [카탈로그 C] → [결과 C (기본)] → [카탈로그 D] → [결과 D (얼굴 강화)]
 *
 * 각 step 은 1~3장의 썸네일을 가로 배치 (FlowStep.srcs[]). 칸 폭은 썸네일 수에
 * 비례. 모든 썸네일 클릭 시 lightbox 로 확대 (ESC / 외부 클릭 / × 로 닫기).
 *
 * 결과 step 은 어떤 합성 모드로 만들었는지 subLabel 로 라벨 하단에 작게 표시.
 *
 * 이미지 파일 규약: public/wedding-snap/mode-examples/<...>.jpg (README 참고).
 * 카탈로그 칸은 SNAP_CATALOG 에서 EXAMPLE_CATALOG_IDS 로 지정한 항목의 마스터를
 * 그대로 사용 — admin 이 mode-examples/ 에 카탈로그 사본을 또 올릴 필요 없음.
 * 파일이 없으면 onError → "준비 중" placeholder 로 fallback.
 */

import { useEffect, useState } from 'react';
import { findSnapCatalog } from '@/lib/snap/catalog';

/**
 * 각 row 의 카탈로그 칸에 보일 catalog id. 운영 중 더 좋은 reference 가 생기면
 * 여기만 바꾸면 됨. (모두 active 항목이어야 함 — hidden 인 항목 쓰면 결과 칸이
 * placeholder 로 빠짐.)
 *
 * 커플 모드는 입력 사진 1장당 2개 카탈로그 → 4개 catalog id (couple1~4).
 */
const EXAMPLE_CATALOG_IDS = {
  groomSolo: 'groom-hotel-stairs',
  brideSolo: 'bride-paris-eiffel',
  together: 'garden-finger-heart',
  couple1a: 'studio-couple-puppy',
  couple1b: 'beach-sunset-sparkler-couple',
  couple2a: 'budapest-bastion-sunset',
  couple2b: 'yosemite-trail-walk',
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
  // lightbox state — 클릭한 썸네일 src.
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
      ? '셀카로 만들기 — 흐름 예시'
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
          className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl"
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
                ? '신랑·신부 각자 셀카 3장(정면/좌45°/우45°)으로 앵커를 만들고, 그 앵커를 카탈로그에 합성합니다. 함께 컷 / 신랑 단독 / 신부 단독 컷 모두 가능. 사진을 누르면 크게 볼 수 있어요.'
                : '두 사람이 함께 찍힌 커플 사진 1장으로 만듭니다. 포즈·체형·상호작용을 그대로 유지하며 카탈로그의 의상/배경만 바꿔요. (함께 컷만 가능)'}
            </p>

            {mode === 'selfies' ? (
              <>
                <ExampleFlowRow
                  title="신랑 단독 컷 만들기"
                  steps={[
                    {
                      srcs: [
                        `${MODE_BASE}/selfies-groom-front.jpg`,
                        `${MODE_BASE}/selfies-groom-left.jpg`,
                        `${MODE_BASE}/selfies-groom-right.jpg`,
                      ],
                      label: '신랑 셀카 3장',
                    },
                    {
                      srcs: [`${MODE_BASE}/selfies-groom-anchor.jpg`],
                      label: '신랑 앵커',
                    },
                    {
                      srcs: [imageForCatalogId(EXAMPLE_CATALOG_IDS.groomSolo)],
                      label: '카탈로그',
                    },
                    {
                      srcs: [`${MODE_BASE}/selfies-groom-result.jpg`],
                      label: '결과',
                      subLabel: '기본 모드',
                    },
                  ]}
                  onPick={setLightboxSrc}
                />
                <ExampleFlowRow
                  title="신부 단독 컷 만들기"
                  steps={[
                    {
                      srcs: [
                        `${MODE_BASE}/selfies-bride-front.jpg`,
                        `${MODE_BASE}/selfies-bride-left.jpg`,
                        `${MODE_BASE}/selfies-bride-right.jpg`,
                      ],
                      label: '신부 셀카 3장',
                    },
                    {
                      srcs: [`${MODE_BASE}/selfies-bride-anchor.jpg`],
                      label: '신부 앵커',
                    },
                    {
                      srcs: [imageForCatalogId(EXAMPLE_CATALOG_IDS.brideSolo)],
                      label: '카탈로그',
                    },
                    {
                      srcs: [`${MODE_BASE}/selfies-bride-result.jpg`],
                      label: '결과',
                      subLabel: '기본 모드',
                    },
                  ]}
                  onPick={setLightboxSrc}
                />
                <ExampleFlowRow
                  title="함께 컷 만들기"
                  steps={[
                    {
                      srcs: [
                        `${MODE_BASE}/selfies-groom-anchor.jpg`,
                        `${MODE_BASE}/selfies-bride-anchor.jpg`,
                      ],
                      label: '신랑 + 신부 앵커',
                    },
                    {
                      srcs: [imageForCatalogId(EXAMPLE_CATALOG_IDS.together)],
                      label: '카탈로그',
                    },
                    {
                      srcs: [`${MODE_BASE}/selfies-together-result.jpg`],
                      label: '결과',
                      subLabel: '기본 모드',
                    },
                  ]}
                  onPick={setLightboxSrc}
                />
              </>
            ) : (
              <>
                {/* 커플 모드 row 1 — input 1 + 2 카탈로그 (각각 기본 / 얼굴 강화). */}
                <ExampleFlowRow
                  title="예시 1 — 반신 이상 클로즈업 커플 사진으로 카탈로그 2종"
                  steps={[
                    {
                      srcs: [`${MODE_BASE}/couple-input-1.jpg`],
                      label: '커플 사진',
                    },
                    {
                      srcs: [imageForCatalogId(EXAMPLE_CATALOG_IDS.couple1a)],
                      label: '카탈로그 A',
                    },
                    {
                      srcs: [`${MODE_BASE}/couple-result-1.jpg`],
                      label: '결과 A',
                      subLabel: '기본 모드',
                    },
                    {
                      srcs: [imageForCatalogId(EXAMPLE_CATALOG_IDS.couple1b)],
                      label: '카탈로그 B',
                    },
                    {
                      srcs: [`${MODE_BASE}/couple-result-1b.jpg`],
                      label: '결과 B',
                      subLabel: '얼굴 강화 모드',
                    },
                  ]}
                  onPick={setLightboxSrc}
                />
                <ExampleFlowRow
                  title="예시 2 — 전신 커플 사진으로 카탈로그 2종"
                  steps={[
                    {
                      srcs: [`${MODE_BASE}/couple-input-2.jpg`],
                      label: '커플 사진',
                    },
                    {
                      srcs: [imageForCatalogId(EXAMPLE_CATALOG_IDS.couple2a)],
                      label: '카탈로그 A',
                    },
                    {
                      srcs: [`${MODE_BASE}/couple-result-2.jpg`],
                      label: '결과 A',
                      subLabel: '기본 모드',
                    },
                    {
                      srcs: [imageForCatalogId(EXAMPLE_CATALOG_IDS.couple2b)],
                      label: '카탈로그 B',
                    },
                    {
                      srcs: [`${MODE_BASE}/couple-result-2b.jpg`],
                      label: '결과 B',
                      subLabel: '얼굴 강화 모드',
                    },
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

      {/* lightbox — 클릭한 썸네일 풀스크린 확대. */}
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

interface FlowStep {
  /** 1~3장 가로 배치. 클릭 시 lightbox 로 개별 확대. */
  srcs: string[];
  label: string;
  /**
   * 라벨 아래 작게 표시할 보조 라벨. 결과 step 에 "기본 모드" / "얼굴 강화 모드"
   * 같은 합성 모드 이름을 노출하는 데 사용.
   */
  subLabel?: string;
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

/**
 * 한 step 의 박스 — 라벨 + 1~3장 썸네일 grid.
 * 썸네일 수에 따라 width / grid-cols 가 비례하게 변동.
 *   1장: w ≈ 64px,  grid-cols-1
 *   2장: w ≈ 112px, grid-cols-2
 *   3장: w ≈ 160px, grid-cols-3
 */
function FlowThumb({
  step,
  onPick,
}: {
  step: FlowStep;
  onPick: (src: string) => void;
}) {
  const count = step.srcs.length;
  const widthClass =
    count === 3
      ? 'w-40 shrink-0 sm:w-48'
      : count === 2
        ? 'w-28 shrink-0 sm:w-32'
        : 'w-16 shrink-0 sm:w-20';
  const colsClass =
    count === 3 ? 'grid-cols-3' : count === 2 ? 'grid-cols-2' : 'grid-cols-1';
  return (
    <div className={`flex ${widthClass} flex-col gap-1`}>
      <div className={`grid gap-0.5 ${colsClass}`}>
        {step.srcs.map((src, idx) => (
          <ThumbBox
            key={`${src}-${idx}`}
            src={src}
            alt={`${step.label} ${count > 1 ? idx + 1 : ''}`.trim()}
            onPick={onPick}
          />
        ))}
      </div>
      <span className="text-center text-[10px] leading-tight text-[#5C4633]">
        {step.label}
      </span>
      {step.subLabel && (
        <span className="text-center text-[9px] leading-tight text-[#8B7355]">
          {step.subLabel}
        </span>
      )}
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
