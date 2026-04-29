import type { InvitationContent } from '@/types/invitation';

interface Props {
  basic: InvitationContent['basic'];
  weddingDate: string | null;
}

export function BasicInfoSlide({ basic, weddingDate }: Props) {
  const hasQuote = basic.quote.enabled && basic.quote.text.trim();
  const hasGreeting = basic.greeting.enabled && basic.greeting.text.trim();
  const familyOn = basic.family.enabled;
  const showDate = basic.showDate && !!weddingDate;

  // If everything inside is off/empty, render a quiet placeholder so the slide
  // doesn't appear as a blank panel.
  if (!hasQuote && !hasGreeting && !familyOn && !showDate) {
    return (
      <section className="flex min-h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <p className="text-sm opacity-70">기본 정보가 설정되어 있지 않습니다</p>
      </section>
    );
  }

  return (
    <section className="flex min-h-full flex-col gap-10 px-6 py-16 text-center">
      <header className="flex flex-col items-center gap-1.5">
        <p className="text-xs tracking-[0.3em] opacity-70">SAVE THE DATE</p>
        <h2 className="text-xl font-light">기본 정보</h2>
      </header>

      {hasQuote && (
        <blockquote className="mx-auto max-w-md text-sm italic leading-relaxed opacity-90">
          “{basic.quote.text}”
        </blockquote>
      )}

      {hasGreeting && (
        <p className="mx-auto max-w-md whitespace-pre-line text-sm leading-relaxed opacity-90">
          {basic.greeting.text}
        </p>
      )}

      {familyOn && <FamilyTable family={basic.family} />}

      {showDate && weddingDate && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs tracking-[0.3em] opacity-70">WEDDING DAY</p>
          <p className="text-base tracking-widest">{formatDate(weddingDate)}</p>
        </div>
      )}
    </section>
  );
}

function FamilyTable({ family }: { family: InvitationContent['basic']['family'] }) {
  const groomLine = familyLine(family.groomFather, family.groomMother);
  const brideLine = familyLine(family.brideFather, family.brideMother);
  if (!groomLine && !brideLine) return null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 text-sm">
      {groomLine && (
        <p>
          <span className="opacity-60">신랑측</span> · {groomLine}
        </p>
      )}
      {brideLine && (
        <p>
          <span className="opacity-60">신부측</span> · {brideLine}
        </p>
      )}
    </div>
  );
}

function familyLine(father: { name: string; deceased: boolean }, mother: { name: string; deceased: boolean }) {
  const parts: string[] = [];
  if (father.name.trim()) parts.push(`${father.deceased ? '故 ' : ''}${father.name.trim()}`);
  if (mother.name.trim()) parts.push(`${mother.deceased ? '故 ' : ''}${mother.name.trim()}`);
  return parts.join(' · ');
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
}
