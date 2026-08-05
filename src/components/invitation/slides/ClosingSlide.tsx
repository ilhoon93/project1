import { ShareButton } from './ShareButton';
import { Reveal } from './Reveal';

export function ClosingSlide({
  message,
  showShare = false,
}: {
  message: string;
  /** 발행용 하객 뷰에서만 true — 중앙 하단에 공유하기 버튼 노출. */
  showShare?: boolean;
}) {
  return (
    <section className="relative flex h-full flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <Reveal className="flex flex-col items-center gap-6">
        <p className="text-xs tracking-[0.3em] text-[var(--mw-accent)]">THANK YOU</p>
        <p className="max-w-md whitespace-pre-line text-base leading-relaxed">
          {message}
        </p>
      </Reveal>
      {showShare && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
          <ShareButton />
        </div>
      )}
    </section>
  );
}
