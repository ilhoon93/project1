'use client';

import { useEffect, useRef, useState } from 'react';
import { FadeUp } from './Motion';
import { SideCaption } from './SideMarginalia';
import type { SocialProofConfig } from '@/lib/marketing/social-proof';

/**
 * 메인 "알림장 소개" 섹션 상단 사회적 증거 — 리뷰(별점·문구) + 커플 수/평점/결제율.
 *
 * - 코랄 톤 배경 밴드로 앞뒤 섹션과 구분.
 * - 리뷰 카드는 좌→우로 끊김 없이 흐르는 마퀴(자동 스크롤). prefers-reduced-motion
 *   에서는 정지.
 * - 커플 수·평균 별점·결제 전환율 수치는 뷰포트 진입 시 랜덤하게 흔들리다가 최종
 *   값으로 수렴하는 카운트업 효과.
 *
 * enabled 가 꺼져 있거나 보여줄 내용이 없으면 렌더하지 않는다.
 */
export function SocialProof({
  config,
  makerPaymentRate,
}: {
  config: SocialProofConfig;
  makerPaymentRate: number;
}) {
  if (!config.enabled) return null;

  const reviews = config.reviews.filter((r) => r.imageUrl.trim());
  const hasCount = config.coupleCount > 0;
  if (!hasCount && reviews.length === 0) return null;

  const rated = reviews.filter((r) => (r.rating ?? 0) > 0);
  const avgRating =
    rated.length > 0
      ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length
      : 0;

  // 마퀴가 끊김 없이 이어지도록 리뷰를 2배로 복제(-50% 이동 시 이음매 없음).
  const marqueeItems = reviews.length > 0 ? [...reviews, ...reviews] : [];
  const marqueeDuration = Math.max(18, reviews.length * 6);

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

        {/* 수치 타일 — 커플 수 / 평균 별점 / 결제 전환. 값이 있는 것만 노출하고
            개수에 맞춰 그리드 열 수를 잡는다. */}
        {(() => {
          const tiles = [
            hasCount && (
              <StatTile
                key="count"
                value={config.coupleCount}
                suffix={config.coupleCountSuffix}
                label={config.coupleCountCaption || '누적 커플'}
              />
            ),
            rated.length > 0 && (
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
            makerPaymentRate > 0 && (
              <StatTile
                key="rate"
                value={makerPaymentRate}
                suffix="%"
                max={100}
                label="제작 후 결제 전환"
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
            <FadeUp scroll delay={0.18}>
              <div
                className={`mt-6 grid ${cols} divide-x divide-[var(--wd-line)] overflow-hidden rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] py-4 text-center`}
              >
                {tiles}
              </div>
            </FadeUp>
          );
        })()}

        {/* 리뷰 마퀴 */}
        {reviews.length > 0 && (
          <FadeUp scroll delay={0.24}>
            <div className="wd-sp-marquee relative mt-7 overflow-hidden">
              {/* 좌우 페이드 마스크 */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--wd-cream)] to-transparent"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--wd-cream)] to-transparent"
              />
              <ul
                className="wd-sp-marquee-track flex w-max gap-3"
                style={{ ['--wd-sp-dur' as string]: `${marqueeDuration}s` }}
              >
                {marqueeItems.map((review, i) => (
                  <li
                    key={`${review.id}-${i}`}
                    className="w-[160px] flex-shrink-0 sm:w-[176px]"
                  >
                    <div className="overflow-hidden rounded-xl border border-[var(--wd-line)] bg-[var(--wd-paper)]">
                      <div className="aspect-[3/4] w-full overflow-hidden bg-[var(--wd-cream)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={review.imageUrl}
                          alt={review.caption || '고객 리뷰'}
                          loading="lazy"
                          draggable={false}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="px-2.5 py-2">
                        {(review.rating ?? 0) > 0 && (
                          <Stars rating={review.rating} size={12} />
                        )}
                        {review.caption && (
                          <p className="mt-1 whitespace-pre-line break-keep text-[11.5px] leading-relaxed text-[var(--wd-mute)]">
                            {review.caption}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>
        )}
      </div>

      {/* 마퀴 keyframes — 절반(-50%) 이동 시 복제본과 이음매 없이 순환. */}
      <style>{`
        @keyframes wd-sp-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .wd-sp-marquee-track {
          animation: wd-sp-marquee var(--wd-sp-dur, 30s) linear infinite;
          will-change: transform;
        }
        .wd-sp-marquee:hover .wd-sp-marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .wd-sp-marquee-track { animation: none; }
        }
      `}</style>
    </section>
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
      <div className="font-italiana text-[22px] leading-none tracking-wide text-[var(--wd-ink)]">
        <FlickerNumber value={value} decimals={decimals} max={max} />
        {suffix && <span className="text-[15px]">{suffix}</span>}
      </div>
      {typeof stars === 'number' && (
        <div className="mt-1 flex justify-center">
          <Stars rating={stars} size={11} />
        </div>
      )}
      <div className="mt-1 text-[10.5px] tracking-[0.06em] text-[var(--wd-mute)]">
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
