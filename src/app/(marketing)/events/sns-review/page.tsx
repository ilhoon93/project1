import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SNS 후기 이벤트 — 발행권 1+1 · 우리다운',
  description:
    '구매 후 SNS에 공개 후기를 남기면 청첩장 발행권을 1개 더 드려요. 참여 방법과 유의사항 안내.',
};

const TALK_URL = 'https://talk.naver.com/ct/wiq8nf0';

const STEPS: { n: string; title: string; desc: React.ReactNode }[] = [
  {
    n: '1',
    title: '우리다운 구매',
    desc: <>네이버 스마트스토어에서 청첩장/AI 스냅 상품을 구매합니다.</>,
  },
  {
    n: '2',
    title: 'SNS에 공개 후기 작성',
    desc: (
      <>
        인스타그램 등 SNS에 <strong>공개(전체공개)</strong>로 후기를 올립니다. 사진 1장 이상 +
        솔직한 후기와 함께 <strong>필수 해시태그 #우리다운 #광고</strong>를 꼭 넣어주세요.
        (&lsquo;#광고&rsquo;는 대가성 표시 의무 — 법적으로 반드시 필요합니다.)
      </>
    ),
  },
  {
    n: '3',
    title: '인증 제출',
    desc: (
      <>
        게시물 <strong>URL + 캡처(작성 계정·닉네임이 보이게)</strong> 와 <strong>네이버 주문번호</strong>를{' '}
        <a href={TALK_URL} target="_blank" rel="noopener noreferrer" className="underline">
          네이버 톡톡
        </a>
        으로 보내주세요.
      </>
    ),
  },
  {
    n: '4',
    title: '확인 후 지급',
    desc: <>운영자가 게시물을 확인한 뒤 청첩장 발행권 1개를 추가로 지급해 드립니다(1+1).</>,
  },
];

const RULES: React.ReactNode[] = [
  <>
    <strong>구매자 한정</strong> · 동일 주문(주문번호) 1건당 1회만 참여할 수 있습니다.
  </>,
  <>
    <strong>지급은 검수 후 진행</strong>됩니다(즉시 자동 지급 아님). 게시물이 일정 기간 정상
    유지되는지 확인한 뒤 지급될 수 있습니다.
  </>,
  <>
    후기는 <strong>공개 상태로 최소 30일 이상 유지</strong>해야 합니다. 조기 삭제·비공개 전환 시
    지급이 보류되며, 이미 지급된 발행권은 <strong>회수</strong>될 수 있습니다.
  </>,
  <>
    <strong>#광고(또는 #협찬) 등 대가성 표시가 없는</strong> 후기는 무효 처리됩니다.
  </>,
  <>
    사진 없는 단순 별점·한 줄 후기, 복사·붙여넣기, 상품과 무관한 내용, 허위·비방성 후기는 제외됩니다.
  </>,
  <>
    허위 캡처, 타인 게시물 도용, 반복 등록·삭제 등 부정 참여가 확인되면 지급 거부 및 향후 이벤트
    참여가 제한될 수 있습니다.
  </>,
  <>회사는 이벤트 내용·기간을 사전 공지 후 변경하거나 종료할 수 있습니다.</>,
];

export default function SnsReviewEventPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
        EVENT
      </div>
      <h1 className="mt-2 text-[24px] font-medium leading-[1.4] tracking-tight text-[var(--wd-ink)] sm:text-[28px]">
        SNS 후기 남기고 <span className="text-[var(--wd-coral)]">발행권 1+1</span> 받기
      </h1>
      <p className="mt-2 text-[14px] leading-[1.75] text-[var(--wd-mute)]">
        우리다운으로 청첩장을 만드신 후 SNS에 공개 후기를 남겨주시면, 청첩장 발행권을 1개 더
        드려요.
      </p>

      {/* 참여 방법 */}
      <h2 className="mt-9 text-[15px] font-semibold text-[var(--wd-ink)]">참여 방법</h2>
      <ol className="mt-3 flex flex-col gap-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex gap-3 rounded-lg border border-[var(--wd-line)] bg-white p-4"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--wd-coral)] text-[12px] font-semibold text-white">
              {s.n}
            </span>
            <div>
              <div className="text-[14px] font-medium text-[var(--wd-ink)]">{s.title}</div>
              <div className="mt-0.5 text-[13px] leading-[1.7] text-[var(--wd-mute)]">
                {s.desc}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* 유의사항 */}
      <h2 className="mt-9 text-[15px] font-semibold text-[var(--wd-ink)]">유의사항</h2>
      <ul className="mt-3 flex list-disc flex-col gap-2 rounded-lg border border-[var(--wd-line)] bg-[var(--wd-paper)] p-4 pl-8 text-[13px] leading-[1.7] text-[var(--wd-mute)]">
        {RULES.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>

      <div className="mt-8 text-center">
        <a
          href={TALK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wd-ink)] px-5 py-3 text-[13px] font-medium text-[var(--wd-cream)]"
        >
          네이버 톡톡으로 인증 제출 →
        </a>
      </div>
    </main>
  );
}
