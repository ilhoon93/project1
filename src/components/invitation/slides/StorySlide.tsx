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
    <section className="flex min-h-full flex-col gap-10 px-6 py-16">
      <SectionHeader header={header} />

      <div className="flex flex-col gap-10">
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
      </div>
    </section>
  );
}
