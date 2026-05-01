import type { InvitationContent } from '@/types/invitation';

interface Props {
  basic: InvitationContent['basic'];
  groomName: string;
  brideName: string;
  weddingDate: string | null;
}

export function BasicInfoSlide({ basic, groomName, brideName, weddingDate }: Props) {
  const hasQuote = basic.quote.enabled && basic.quote.text.trim();
  const hasGreeting = basic.greeting.enabled && basic.greeting.text.trim();
  const familyOn = basic.family.enabled;
  const showDate = basic.showDate && !!weddingDate;

  const groomFamily = familyLine(basic.family.groomFather, basic.family.groomMother);
  const brideFamily = familyLine(basic.family.brideFather, basic.family.brideMother);
  const hasGroomName = !!groomName.trim();
  const hasBrideName = !!brideName.trim();
  const hasNames = hasGroomName || hasBrideName;
  const hasFamily = familyOn && (groomFamily || brideFamily);

  // If everything inside is off/empty, render a quiet placeholder so the slide
  // doesn't appear as a blank panel.
  if (!hasQuote && !hasGreeting && !hasNames && !hasFamily && !showDate) {
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
        <h2 className="text-xl font-light">우리 결혼합니다</h2>
      </header>

      {/* Order: 글귀 → 인사말 → 이름 → 날짜 */}

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

      {(hasNames || hasFamily) && (
        <NamesSection
          familyOn={familyOn}
          groomFamily={groomFamily}
          brideFamily={brideFamily}
          groomName={groomName}
          brideName={brideName}
        />
      )}

      {showDate && weddingDate && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs tracking-[0.3em] opacity-70">WEDDING DAY</p>
          <p className="text-base tracking-widest">{formatDate(weddingDate)}</p>
        </div>
      )}
    </section>
  );
}

/**
 * Couple's names shown together in a single block. Family info, when enabled,
 * sits above each name as a small caption — but groom and bride sit
 * side-by-side so they read as one unit (per the "함께 보여지게" requirement).
 */
function NamesSection({
  familyOn,
  groomFamily,
  brideFamily,
  groomName,
  brideName,
}: {
  familyOn: boolean;
  groomFamily: string;
  brideFamily: string;
  groomName: string;
  brideName: string;
}) {
  const showFamilyCaption = familyOn && (groomFamily || brideFamily);

  return (
    <div className="mx-auto flex max-w-md items-stretch justify-center gap-4 text-sm sm:gap-6">
      <PersonBlock
        familyCaption={showFamilyCaption ? groomFamily : ''}
        roleLabel={showFamilyCaption && groomFamily ? '의 아들' : null}
        name={groomName}
      />
      <span className="self-center px-1 text-base opacity-50" aria-hidden>
        ·
      </span>
      <PersonBlock
        familyCaption={showFamilyCaption ? brideFamily : ''}
        roleLabel={showFamilyCaption && brideFamily ? '의 딸' : null}
        name={brideName}
      />
    </div>
  );
}

function PersonBlock({
  familyCaption,
  roleLabel,
  name,
}: {
  familyCaption: string;
  roleLabel: string | null;
  name: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      {familyCaption && (
        <p className="text-xs leading-snug opacity-70">
          {familyCaption}
          {roleLabel}
        </p>
      )}
      {name.trim() && <p className="text-base font-medium tracking-wide">{name}</p>}
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
