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
 *
 * 부모 이름은 두 줄로 분리(부모 · 부모 / 의 아들·딸)해서 좁은 화면에서도
 * 한글 단어가 어중간하게 끊어지는 일이 없게 한다. word-break:keep-all 도
 * 같이 적용해 한글 단어가 글자 단위로 쪼개지지 않도록 한다.
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
    <div className="mx-auto grid w-full max-w-md grid-cols-[1fr_auto_1fr] items-end justify-items-center gap-3 sm:gap-6">
      <PersonBlock
        familyCaption={showFamilyCaption ? groomFamily : ''}
        roleLabel="의 아들"
        name={groomName}
      />
      <span
        className="self-center px-1 text-2xl font-light opacity-40"
        aria-hidden
      >
        ·
      </span>
      <PersonBlock
        familyCaption={showFamilyCaption ? brideFamily : ''}
        roleLabel="의 딸"
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
  roleLabel: string;
  name: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      {familyCaption && (
        <div className="flex flex-col items-center text-sm leading-snug opacity-70 [word-break:keep-all]">
          <p>{familyCaption}</p>
          <p>{roleLabel}</p>
        </div>
      )}
      {name.trim() && (
        <p className="text-2xl font-medium tracking-wide [word-break:keep-all]">
          {name}
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
