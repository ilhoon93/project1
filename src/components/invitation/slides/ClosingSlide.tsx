import { ShareButton } from './ShareButton';

export function ClosingSlide({
  message,
  showShare = false,
}: {
  message: string;
  /** 발행용 하객 뷰에서만 true — 중앙 하단에 공유하기 버튼 노출. */
  showShare?: boolean;
}) {
  // 등장 애니메이션은 슬라이드 전환 효과(globals.css .wd-reveal)가 담당한다. 예전엔
  // 내부 Reveal(framer) 이 자체적으로 opacity 를 애니메이션해 CSS reveal 과 겹치며
  // "깜빡임"이 생겼고, 공유 버튼은 절대배치라 별도 처리한다.
  return (
    <section className="relative flex h-full flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-6">
        <p className="text-xs tracking-[0.3em] text-[var(--mw-accent)]">THANK YOU</p>
        <p className="max-w-md whitespace-pre-line text-base leading-relaxed">
          {message}
        </p>
      </div>
      {showShare && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
          <ShareButton />
        </div>
      )}
    </section>
  );
}
