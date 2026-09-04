import type {
  InvitationContent,
  ResolvedSectionHeader,
} from '@/types/invitation';
import { SectionHeader } from './SectionHeader';

export function StorySlide({
  story,
  header,
}: {
  story: InvitationContent['story'];
  header: ResolvedSectionHeader;
}) {
  // Skip chapters that have nothing to show.
  const chapters = story.chapters.filter((c) => c.title || c.text || c.image);
  if (chapters.length === 0) return null;

  return (
    // 챕터를 섹션의 직속 자식으로 둔다(래퍼 div 없이) — 슬라이드 전환 효과가
    // 켜지면 제목부에 이어 각 챕터가 위에서부터 순서대로 떠오르도록. gap-10 은
    // 기존 래퍼와 동일해 보이는 모습은 그대로.
    <section className="flex min-h-full flex-col gap-10 px-6 py-16">
      <SectionHeader header={header} />

      {chapters.map((chapter, i) => (
        <article key={i} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs tracking-widest opacity-60">
              {String(i + 1).padStart(2, '0')}
            </span>
            {chapter.title && (
              <h3 className="text-base font-medium">{chapter.title}</h3>
            )}
          </div>
          {chapter.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={chapter.image}
              alt={chapter.title || `챕터 ${i + 1}`}
              className="aspect-[4/3] w-full rounded-md object-cover"
            />
          )}
          {chapter.text && (
            <p className="whitespace-pre-line text-sm leading-relaxed opacity-90">
              {chapter.text}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
