import { FadeUp } from './Motion';
import { SideCaption } from './SideMarginalia';
import type { SocialProofConfig } from '@/lib/marketing/social-proof';

/**
 * 메인 "알림장 소개" 섹션 하단 사회적 증거 — 리뷰 이미지 + 커플 수.
 *
 * 운영자 설정(marketing_social_proof)을 그대로 받아 렌더한다. `enabled` 가 꺼져
 * 있거나 보여줄 내용(커플 수·리뷰)이 하나도 없으면 아무것도 렌더하지 않는다 —
 * 랜딩이 빈 섹션으로 어색해지지 않도록.
 */
export function SocialProof({ config }: { config: SocialProofConfig }) {
  if (!config.enabled) return null;

  const reviews = config.reviews.filter((r) => r.imageUrl.trim());
  const hasCount = config.coupleCount > 0;
  if (!hasCount && reviews.length === 0) return null;

  return (
    <section className="relative border-t border-[var(--wd-line)] px-6 py-14 sm:py-16">
      <SideCaption text="REAL COUPLES" side="right" topPct={46} />

      <div className="mx-auto max-w-3xl">
        {config.heading && (
          <FadeUp scroll>
            <h2 className="break-keep text-[20px] font-medium leading-[1.45] tracking-tight sm:text-[22px]">
              {config.heading}
            </h2>
          </FadeUp>
        )}
        {config.subheading && (
          <FadeUp scroll delay={0.08}>
            <p className="mt-2 break-keep text-[14px] leading-[1.75] text-[var(--wd-mute)]">
              {config.subheading}
            </p>
          </FadeUp>
        )}

        {/* 커플 수 강조 */}
        {hasCount && (
          <FadeUp scroll delay={0.14}>
            <div className="mt-6 inline-flex items-baseline gap-2 rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] px-5 py-3">
              <span className="font-italiana text-[32px] leading-none tracking-wide text-[var(--wd-coral)]">
                {config.coupleCount.toLocaleString('ko-KR')}
                <span className="ml-0.5 text-[18px]">{config.coupleCountSuffix}</span>
              </span>
              {config.coupleCountCaption && (
                <span className="text-[12.5px] text-[var(--wd-mute)]">
                  {config.coupleCountCaption}
                </span>
              )}
            </div>
          </FadeUp>
        )}

        {/* 리뷰 이미지 — 가로 스크롤 스트립. */}
        {reviews.length > 0 && (
          <FadeUp scroll delay={0.2}>
            <ul className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="w-[150px] flex-shrink-0 snap-start sm:w-[168px]"
                >
                  <div className="overflow-hidden rounded-xl border border-[var(--wd-line)] bg-[var(--wd-paper)]">
                    <div className="aspect-[3/4] w-full overflow-hidden bg-[var(--wd-cream)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={review.imageUrl}
                        alt={review.caption || '고객 리뷰'}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {review.caption && (
                      <p className="break-keep px-2.5 py-2 text-[11.5px] leading-relaxed text-[var(--wd-mute)]">
                        {review.caption}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </FadeUp>
        )}
      </div>
    </section>
  );
}
