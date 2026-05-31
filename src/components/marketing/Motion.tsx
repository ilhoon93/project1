'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * 마케팅 페이지용 진입 애니메이션 래퍼.
 *
 * - 기본: 마운트 시 8~12px 슬라이드업 + fade-in, 400~500ms.
 * - `scroll`=true 면 viewport 진입 시 한 번만 트리거 (IntersectionObserver).
 * - `prefers-reduced-motion` 사용자에겐 애니메이션 없이 정적 렌더 (프로젝트
 *   기존 정책과 동일 — globals.css 의 motion guard 와 같은 사상).
 *
 * delay 를 명시적으로 줘 형제 요소를 stagger 시킨다.
 */
export function FadeUp({
  children,
  delay = 0,
  // 0.65 → 0.95 로 살짝 늘려 메인 Hero 헤드라인/카피의 등장이 조금 더 천천히
  // 떠오르도록. 사용자 요청.
  duration = 0.95,
  y = 22,
  scroll = false,
  className,
  as: As = 'div',
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  /** 시작 시점의 y 오프셋(px). 기본 22px — 평범한 desktop 에서도 확실히 인지 가능. */
  y?: number;
  /** true 면 스크롤 viewport 진입 시 트리거, false 면 마운트 시. */
  scroll?: boolean;
  className?: string;
  as?: 'div' | 'span' | 'section';
}) {
  const reduce = useReducedMotion();
  const MotionAs = motion[As] as typeof motion.div;

  if (reduce) {
    return <As className={className}>{children}</As>;
  }

  const initial = { opacity: 0, y };
  const target = { opacity: 1, y: 0 };
  const transition = { duration, delay, ease: 'easeOut' as const };

  if (scroll) {
    return (
      <MotionAs
        className={className}
        initial={initial}
        whileInView={target}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        {children}
      </MotionAs>
    );
  }

  return (
    <MotionAs
      className={className}
      initial={initial}
      animate={target}
      transition={transition}
    >
      {children}
    </MotionAs>
  );
}
