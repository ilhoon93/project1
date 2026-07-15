'use client';

import { useEffect, useRef, useState } from 'react';
import { FadeUp } from './Motion';
import { SideCaption } from './SideMarginalia';
import { InvitationPreview } from './InvitationPreview';
import type {
  SocialProofConfig,
  ShowcaseCover,
} from '@/lib/marketing/social-proof';

/**
 * 메인 "알림장 소개" 섹션 상단 사회적 증거 — 리뷰(별점·문구) + 커플 수/평점/결제율.
 *
 * - 코랄 톤 배경 밴드로 앞뒤 섹션과 구분.
 * - 리뷰 카드는 좌→우로 끊김 없이 흐르는 마퀴(자동 스크롤). prefers-reduced-motion
 *   에서는 정지.
 * - 커플 수·평균 별점 수치는 뷰포트 진입 시 랜덤하게 흔들리다가 최종 값으로
 *   수렴하는 카운트업 효과.
 *
 * enabled 가 꺼져 있거나 보여줄 내용이 없으면 렌더하지 않는다.
 */
export function SocialProof({
  config,
  coupleCount,
  purchasePct,
}: {
  config: SocialProofConfig;
  /** 발행 건수 기반 자동 계산된 커플 수(10단위 올림). 0 이면 커플 수 타일 미노출. */
  coupleCount: number;
  /** 제작→결제 전환율(%). 통계에서 자동 계산. 0 이면 % 타일/문구 미노출. */
  purchasePct: number;
}) {
  if (!config.enabled) return null;

  // 별점·문구 리뷰(텍스트 마퀴)와 알림장 디자인(디자인 마퀴)을 분리.
  const reviews = config.reviews.filter((r) => r.caption.trim() || r.rating > 0);
  const covers = config.covers ?? [];
  const designImages = config.designs.filter((d) => d.imageUrl.trim());
  // 디자인 마퀴 = config 렌더 커버(스티커 익명화된 실제 고객 디자인) + 레거시 업로드 이미지.
  const hasDesigns = covers.length > 0 || designImages.length > 0;
  const hasCount = coupleCount > 0;
  const avgRating = config.averageRating; // 관리자 세팅값(0 이면 미노출).
  const showPurchase = config.purchaseStatEnabled && purchasePct > 0;

  if (!hasCount && !showPurchase && avgRating <= 0 && reviews.length === 0 && !hasDesigns)
    return null;

  const purchaseSentence = config.purchaseStatCaption.replace(
    '{pct}',
    String(purchasePct),
  );

  return (
    <section className="relative border-y border-[var(--wd-line)] bg-[var(--wd-coral)]/[0.07] px-6 py-14 sm:py-16">
      <SideCaption text="REAL COUPLES" side="left" topPct={44} />

      <div className="mx-auto max-w-3xl">
        <FadeUp scroll>
          <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
            REAL COUPLES · REAL REVIEWS
          </div>
        </FadeUp>
        {config.heading && (
          <FadeUp scroll delay={0.06}>
            <h2 className="mt-2 break-keep text-[20px] font-medium leading-[1.45] tracking-tight sm:text-[22px]">
              {config.heading}
            </h2>
          </FadeUp>
        )}
        {config.subheading && (
          <FadeUp scroll delay={0.12}>
            <p className="mt-2 break-keep text-[14px] leading-[1.75] text-[var(--wd-mute)]">
              {config.subheading}
            </p>
          </FadeUp>
        )}

        {/* 대표 문구 — "만들어본 고객의 N%가 2주 내로 구매를 결정했어요." N 강조. */}
        {showPurchase && purchaseSentence && (
          <FadeUp scroll delay={0.16}>
            <p className="mt-5 break-keep text-[16px] font-medium leading-[1.6] text-[var(--wd-ink)] sm:text-[18px]">
              {renderWithPct(purchaseSentence, purchasePct)}
            </p>
          </FadeUp>
        )}

        {/* 수치 타일 — 건수 / N% / 별점. 값이 있는 것만 노출하고 개수에 맞춰 열 수 결정. */}
        {(() => {
          const tiles = [
            hasCount && (
              <StatTile
                key="count"
                value={coupleCount}
                suffix={config.coupleCountSuffix}
                label={config.coupleCountCaption || '누적 커플'}
              />
            ),
            showPurchase && (
              <StatTile
                key="purchase"
                value={purchasePct}
                max={100}
                suffix="%"
                label={config.purchaseStatLabel || '2주 내 구매 결정'}
              />
            ),
            avgRating > 0 && (
              <StatTile
                key="rating"
                value={avgRating}
                decimals={1}
                max={5}
                suffix=" / 5"
                label="평균 별점"
                stars={avgRating}
              />
            ),
          ].filter(Boolean);
          if (tiles.length === 0) return null;
          const cols =
            tiles.length === 1
              ? 'grid-cols-1'
              : tiles.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3';
          return (
            <FadeUp scroll delay={0.2}>
              <div
                className={`mt-6 grid ${cols} divide-x divide-[var(--wd-line)] overflow-hidden rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] py-4 text-center`}
              >
                {tiles}
              </div>
            </FadeUp>
          );
        })()}

        {/* 디자인 마퀴 (→ 방향) — config 렌더 커버 + 레거시 업로드 이미지. */}
        {hasDesigns && (
          <FadeUp scroll delay={0.24}>
            <Marquee
              reverse={false}
              durationSec={Math.max(20, (covers.length + designImages.length) * 5)}
            >
              {(() => {
                const items = [
                  ...covers.map((c) => ({
                    key: `cover-${c.id}`,
                    node: <CoverCard cover={c} />,
                  })),
                  ...designImages.map((d) => ({
                    key: `img-${d.id}`,
                    node: (
                      <div className="overflow-hidden rounded-xl border border-[var(--wd-line)] bg-[var(--wd-paper)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={d.imageUrl}
                          alt="알림장 디자인"
                          loading="lazy"
                          draggable={false}
                          className="block w-full"
                        />
                      </div>
                    ),
                  })),
                ];
                return [...items, ...items].map((item, i) => (
                  <li
                    key={`${item.key}-${i}`}
                    className="w-[124px] flex-shrink-0 sm:w-[140px]"
                  >
                    {item.node}
                  </li>
                ));
              })()}
            </Marquee>
          </FadeUp>
        )}

        {/* 리뷰 텍스트 마퀴 (← 반대 방향) — 별점 + 문구. */}
        {reviews.length > 0 && (
          <FadeUp scroll delay={0.28}>
            <Marquee reverse durationSec={Math.max(18, reviews.length * 7)}>
              {[...reviews, ...reviews].map((review, i) => (
                <li
                  key={`${review.id}-${i}`}
                  className="w-[230px] flex-shrink-0 sm:w-[250px]"
                >
                  <div className="flex h-full flex-col rounded-xl border border-[var(--wd-line)] bg-[var(--wd-paper)] px-3.5 py-3">
                    {(review.rating ?? 0) > 0 && (
                      <Stars rating={review.rating} size={13} />
                    )}
                    {review.caption && (
                      <p className="mt-1.5 line-clamp-[8] break-keep text-[12.5px] leading-relaxed text-[var(--wd-ink)]">
                        {review.caption}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </Marquee>
          </FadeUp>
        )}
      </div>

      {/* 마퀴 keyframes — 절반(-50%) 이동 시 복제본과 이음매 없이 순환.
          reverse 는 방향만 반대(왼쪽에서 오른쪽으로 흐름). */}
      <style>{`
        @keyframes wd-sp-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes wd-sp-marquee-rev {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        .wd-sp-marquee-track {
          animation: wd-sp-marquee var(--wd-sp-dur, 30s) linear infinite;
          will-change: transform;
        }
        .wd-sp-marquee-track--rev {
          animation-name: wd-sp-marquee-rev;
        }
        /* 마우스(hover 가능 기기)에서만 일시정지 — 터치 기기는 손을 대도 계속 흐른다. */
        @media (hover: hover) {
          .wd-sp-marquee:hover .wd-sp-marquee-track {
            animation-play-state: paused;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .wd-sp-marquee-track { animation: none; }
        }
      `}</style>
    </section>
  );
}

/** showcase 커버 — 실제 고객 디자인을 config 렌더로 9:18 카드에 표시(익명화 상태). */
function CoverCard({ cover }: { cover: ShowcaseCover }) {
  return (
    <div className="aspect-[1/2] w-full overflow-hidden rounded-xl border border-[var(--wd-line)] bg-[var(--wd-paper)]">
      <InvitationPreview
        design={{
          id: cover.id,
          name: '',
          layoutLabel: '',
          groomName: cover.groomName,
          brideName: cover.brideName,
          weddingDate: cover.weddingDate,
          content: cover.content,
        }}
        cover
      />
    </div>
  );
}

/** 좌우 페이드 마스크 + 자동 스크롤 트랙을 감싸는 마퀴 컨테이너. */
function Marquee({
  children,
  reverse,
  durationSec,
}: {
  children: React.ReactNode;
  reverse: boolean;
  durationSec: number;
}) {
  return (
    <div className="wd-sp-marquee relative mt-6 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--wd-cream)] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--wd-cream)] to-transparent"
      />
      <ul
        className={`wd-sp-marquee-track flex w-max items-stretch gap-3 ${reverse ? 'wd-sp-marquee-track--rev' : ''}`}
        style={{ ['--wd-sp-dur' as string]: `${durationSec}s` }}
      >
        {children}
      </ul>
    </div>
  );
}

/** 문구 안의 "N%" 를 코랄 굵게 강조해서 렌더. */
function renderWithPct(sentence: string, pct: number) {
  const token = `${pct}%`;
  const idx = sentence.indexOf(token);
  if (idx === -1) return sentence;
  return (
    <>
      {sentence.slice(0, idx)}
      <span className="font-bold text-[var(--wd-coral)]">{token}</span>
      {sentence.slice(idx + token.length)}
    </>
  );
}

/** 수치 타일 — 카운트업 숫자 + 라벨(+옵션 별점). */
function StatTile({
  value,
  label,
  decimals = 0,
  suffix = '',
  max,
  stars,
}: {
  value: number;
  label: string;
  decimals?: number;
  suffix?: string;
  max?: number;
  stars?: number;
}) {
  return (
    <div className="px-2">
      {/* 볼드 산세리프 — '+' 등 기호도 또렷하게 보이도록(장식용 italiana 대신). */}
      <div className="text-[34px] font-bold leading-none tracking-tight text-[var(--wd-ink)] sm:text-[40px]">
        <FlickerNumber value={value} decimals={decimals} max={max} />
        {suffix && <span className="text-[22px] font-bold sm:text-[24px]">{suffix}</span>}
      </div>
      {typeof stars === 'number' && (
        <div className="mt-1.5 flex justify-center">
          <Stars rating={stars} size={13} />
        </div>
      )}
      <div className="mt-1.5 text-[11px] tracking-[0.06em] text-[var(--wd-mute)]">
        {label}
      </div>
    </div>
  );
}

/** 별점 표시 (읽기 전용) — 반올림해 채운다. */
function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  const filled = Math.round(rating);
  return (
    <span
      aria-label={`5점 만점에 ${rating.toFixed(1)}점`}
      className="inline-flex items-center gap-0.5 leading-none"
      style={{ fontSize: size }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          style={{ color: i < filled ? 'var(--wd-coral)' : 'rgba(31,27,23,0.18)' }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * 뷰포트 진입 시 랜덤하게 흔들리다가 최종 값으로 수렴하는 카운트업 숫자.
 * prefers-reduced-motion 이면 즉시 최종값.
 */
function FlickerNumber({
  value,
  decimals = 0,
  max,
}: {
  value: number;
  decimals?: number;
  max?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplay(value);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        const duration = 1500;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          if (t < 1) {
            const smooth = t * t * (3 - 2 * t); // smoothstep 이징
            const eased = value * smooth;
            const jitter = value * 0.3 * (1 - t) * (Math.random() * 2 - 1);
            let next = Math.max(0, eased + jitter);
            if (typeof max === 'number') next = Math.min(max, next);
            setDisplay(next);
            rafRef.current = requestAnimationFrame(tick);
          } else {
            setDisplay(value);
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, max]);

  const text =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('ko-KR');

  return <span ref={ref}>{text}</span>;
}
