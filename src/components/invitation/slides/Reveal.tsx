'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * 정보 슬라이드 요소가 뷰포트(가로 스와이프로 슬라이드 진입 / 세로 스크롤)에 들어올 때
 * 부드럽게 "떠오르는" 등장 효과. once=한 번만 재생해 스와이프를 오가도 다시 튀지 않는다.
 *
 * 접근성: `prefers-reduced-motion` 사용자(어르신·멀미 민감)에겐 애니메이션 없이 즉시
 * 표시한다 — 혼주용 큰 글씨 타깃과도 맞물린다.
 */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  /** 순차 등장용 지연(초). 헤더 다음에 본문이 살짝 늦게 뜨는 식. */
  delay?: number;
  /** 시작 시 아래로 내려둘 거리(px). */
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
