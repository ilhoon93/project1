import {
  reconcileBasicSubOrder,
  type BasicSubKey,
  type InvitationContent,
  type ResolvedSectionHeader,
} from '@/types/invitation';
import { formatWeddingDate, elapsedYMD } from '@/lib/utils/format-date';
import { SectionHeader } from './SectionHeader';

interface Props {
  basic: InvitationContent['basic'];
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  header: ResolvedSectionHeader;
}

export function BasicInfoSlide({ basic, groomName, brideName, weddingDate, header }: Props) {
  const hasQuote = basic.quote.enabled && basic.quote.text.trim();
  const hasGreeting = basic.greeting.enabled && basic.greeting.text.trim();
  const familyOn = basic.family.enabled;
  const showDate = basic.showDate && !!weddingDate;
  const hasTogether = basic.together.enabled && !!basic.together.sinceDate;

  const groomFamily = familyLine(basic.family.groomFather, basic.family.groomMother);
  const brideFamily = familyLine(basic.family.brideFather, basic.family.brideMother);
  const hasGroomName = !!groomName.trim();
  const hasBrideName = !!brideName.trim();
  const hasNames = hasGroomName || hasBrideName;
  const hasFamily = familyOn && (groomFamily || brideFamily);

  // 사용자가 에디터에서 정한 순서 그대로. 빈 키는 reconcile 이 자동 보충.
  const order = reconcileBasicSubOrder(basic.subOrder);

  // If everything inside is off/empty, render a quiet placeholder so the slide
  // doesn't appear as a blank panel.
  if (!hasQuote && !hasGreeting && !hasNames && !hasFamily && !showDate && !hasTogether) {
    return (
      <section className="flex min-h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <p className="text-sm opacity-70">기본 정보가 설정되어 있지 않습니다</p>
      </section>
    );
  }

  const renderSub = (key: BasicSubKey) => {
    if (key === 'quote' && hasQuote) {
      return (
        <blockquote
          key={key}
          className="mx-auto max-w-md whitespace-pre-line text-sm italic leading-relaxed opacity-90"
        >
          “{basic.quote.text}”
        </blockquote>
      );
    }
    if (key === 'greeting' && hasGreeting) {
      // 인사말은 위/아래 디바이더로 시각적으로 분리 — 방명록의 GuestbookDivider 와
      // 동일 스타일 (얇은 가로 라인 + 가운데 ✦ 글리프).
      return (
        <div key={key} className="flex flex-col items-center gap-4">
          <BasicInfoDivider />
          <p className="mx-auto max-w-md whitespace-pre-line text-sm leading-relaxed opacity-90">
            {basic.greeting.text}
          </p>
          <BasicInfoDivider />
        </div>
      );
    }
    if (key === 'family' && (hasNames || hasFamily)) {
      return (
        <NamesSection
          key={key}
          familyOn={familyOn}
          groomFamily={groomFamily}
          brideFamily={brideFamily}
          groomName={groomName}
          brideName={brideName}
        />
      );
    }
    if (key === 'date' && showDate && weddingDate) {
      return (
        <div key={key} className="flex flex-col items-center gap-1">
          <p className="text-xs tracking-[0.3em] opacity-70">WEDDING DAY</p>
          {/* weddingDate 는 InvitationSlides 가 basic.dateFormat 으로 사전 포맷팅한 string. */}
          <p className="text-base tracking-widest">{weddingDate}</p>
        </div>
      );
    }
    if (key === 'together' && hasTogether && basic.together.sinceDate) {
      const elapsed = elapsedYMD(basic.together.sinceDate);
      if (!elapsed) return null;
      return (
        <div key={key} className="flex flex-col items-center gap-1">
          <p className="text-xs tracking-[0.3em] opacity-70">WITH YOU</p>
          <p className="text-base tracking-wide">함께한 지 {elapsed}</p>
          <p className="text-xs opacity-70">
            {formatWeddingDate(basic.together.sinceDate, basic.dateFormat)}부터
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    // 다른 슬라이드(스토리·갤러리 등)와 동일하게 헤더를 상단에 두고 본문을 아래로.
    // 이전엔 justify-center 로 전체를 세로 가운데 정렬해 제목이 화면 중앙에 떠
    // 다른 슬라이드 제목들과 위치·형식이 어긋났음.
    <section className="flex min-h-full flex-col gap-8 px-6 py-16 text-center">
      <SectionHeader header={header} />

      {order.map((k) => renderSub(k))}
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

/**
 * 인사말 위/아래에 그리는 디바이더. 방명록 GuestbookDivider 와 같은 형식 —
 * 얇은 가로 라인 + 가운데 작은 다이아 글리프. 폭은 max-w-[12rem] 으로 본문보다
 * 좁게 잡아 인사말을 가운데로 모으는 느낌.
 */
function BasicInfoDivider() {
  return (
    <div
      aria-hidden
      className="mx-auto flex w-full max-w-[12rem] items-center justify-center gap-3 opacity-60"
    >
      <span className="h-px flex-1 bg-current" style={{ opacity: 0.55 }} />
      <span className="text-[0.85em] leading-none">✦</span>
      <span className="h-px flex-1 bg-current" style={{ opacity: 0.55 }} />
    </div>
  );
}
