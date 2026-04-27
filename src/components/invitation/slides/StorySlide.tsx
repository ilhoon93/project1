import type { InvitationContent } from '@/types/invitation';

export function StorySlide({ story }: { story: InvitationContent['story'] }) {
  return (
    <section className="flex min-h-full flex-col gap-10 px-6 py-16">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] text-[#8B7355]">OUR STORY</p>
        <h2 className="mt-2 text-xl font-light">우리 이야기</h2>
      </header>

      <div className="flex flex-col gap-8">
        {story.chapters.map((chapter, i) => (
          <article key={chapter.title} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs tracking-widest text-[#B8A18A]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-base font-medium text-[#3D2E1F]">{chapter.title}</h3>
            </div>
            {chapter.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={chapter.image}
                alt={chapter.title}
                className="aspect-[4/3] w-full rounded-md object-cover"
              />
            )}
            {chapter.text && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-[#5C4633]">
                {chapter.text}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
