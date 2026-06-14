import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '자주 묻는 질문 (FAQ) — 우리다운',
  description: '알림장 유효기간·영구소장·결제/환불·AI 웨딩스냅·서비스 안내 등 자주 묻는 질문',
};

interface QA {
  q: string;
  a: React.ReactNode;
}

const TALK_URL = 'https://talk.naver.com/ct/wiq8nf0';

const FAQS: QA[] = [
  {
    q: '발행한 알림장은 얼마나 볼 수 있나요?',
    a: (
      <>
        발행한 공개 링크(하객용)는 <strong>발행일로부터 최소 30일</strong> 유지됩니다. 예식일을
        입력하셨다면 <strong>예식일로부터 30일</strong>과 비교해 더 늦은 시점까지 유지돼요.
      </>
    ),
  },
  {
    q: '예식일을 입력하지 않으면 만료는 어떻게 되나요?',
    a: <>예식일이 없으면 <strong>발행한 날로부터 30일</strong> 뒤에 만료됩니다.</>,
  },
  {
    q: "'영구소장'은 무엇인가요?",
    a: (
      <>
        영구소장을 적용하면 위 유효기간과 관계없이 <strong>하객용·소장용 링크가 만료 없이
        유지</strong>됩니다. 결혼 후에도 오래 간직하고 공유할 수 있어요. (단, 서비스가 종료되는
        경우에는 아래 안내의 영향을 받을 수 있습니다.)
      </>
    ),
  },
  {
    q: '발행권·영구소장·스냅 크레딧은 각각 무엇인가요?',
    a: (
      <>
        <strong>발행권</strong>은 알림장을 공개(발행)할 때, <strong>영구소장</strong>은 발행한
        알림장을 만료 없이 보관할 때, <strong>AI 스냅 크레딧</strong>은 AI 웨딩스냅 사진을 생성할
        때 사용합니다. &lsquo;알림장 + 영구소장 + 웨딩스냅 5장&rsquo; 같은 묶음 상품을 구매하면 해당
        혜택이 한 번에 적립돼요.
      </>
    ),
  },
  {
    q: '결제와 환불은 어떻게 하나요?',
    a: (
      <>
        구매는 <strong>네이버 스마트스토어</strong>에서 이루어집니다. 결제·취소·환불도 네이버
        스마트스토어 절차와 전자상거래법에 따르며, 구매 후 <strong>사용하지 않은</strong> 크레딧은
        구매일로부터 7일 이내 취소(환불)할 수 있어요. 이미 사용(발행·생성 완료)된 분은
        디지털콘텐츠 특성상 환불이 제한됩니다. 시스템 오류로 생성에 실패한 경우 해당 크레딧은
        자동으로 돌려드립니다.
      </>
    ),
  },
  {
    q: '주문한 크레딧은 어떻게 적립하나요?',
    a: (
      <>
        마이페이지의 <strong>주문번호로 등록</strong>에서 네이버 스마트스토어 주문번호와 본인 확인용
        주문자 휴대폰 뒷 4자리를 입력하면 해당 상품의 크레딧이 계정에 적립됩니다.
      </>
    ),
  },
  {
    q: 'AI 웨딩스냅은 무엇인가요?',
    a: (
      <>
        셀카 또는 커플 사진을 올리면 AI가 다양한 컨셉의 <strong>웨딩 화보 느낌 사진</strong>을
        만들어 주는 기능이에요. 생성한 사진은 다운로드하거나 알림장에 넣어 활용할 수 있습니다.
      </>
    ),
  },
  {
    q: '무료로 체험할 수 있나요?',
    a: (
      <>
        가입 후 AI 웨딩스냅을 처음 시작하면 <strong>무료 체험 크레딧</strong>을 드려요(커플 사진
        1장 생성 분량). 더 많이 만들고 싶으면 네이버 스마트스토어에서 크레딧을 구매하시면 됩니다.
      </>
    ),
  },
  {
    q: 'AI 스냅 결과가 마음에 안 들면 어떻게 하나요?',
    a: (
      <>
        결과가 아쉬우면 사유를 선택해 <strong>재생성</strong>할 수 있어요. 또한 시스템 오류로 생성에
        실패한 경우에는 사용된 스냅 크레딧이 <strong>자동 환원</strong>됩니다.
      </>
    ),
  },
  {
    q: '하객(받는 분)은 무엇을 할 수 있나요?',
    a: (
      <>
        하객은 별도 로그인 없이 <strong>방명록·축하 서명·투표/퀴즈·갤러리 좋아요·축하하기</strong>
        등으로 마음을 남길 수 있어요. 남겨진 메시지와 서명은 소장용 화면에서 모아 볼 수 있습니다.
      </>
    ),
  },
  {
    q: '만들다 만 알림장(임시저장)은 얼마나 보관되나요?',
    a: (
      <>
        발행하지 않은 임시저장 알림장은 <strong>약 14일간 수정이 없으면</strong> 정리될 수 있어요.
        발행했거나 영구소장한 알림장은 유효기간/영구소장 정책에 따라 유지됩니다.
      </>
    ),
  },
  {
    q: '서비스가 종료되면 내 알림장과 사진은 어떻게 되나요?',
    a: (
      <>
        서비스를 종료하게 되는 경우 <strong>최소 30일 전에 공지</strong>해 드립니다. 다만 종료
        후에는 영구소장을 포함한 링크와 데이터가 더 이상 제공되지 않고 삭제될 수 있으니, 소중한
        사진·내용은 <strong>미리 저장(다운로드)</strong>해 두시길 권장합니다.
      </>
    ),
  },
  {
    q: '업로드한 사진은 안전하게 보관되나요?',
    a: (
      <>
        업로드 사진은 비공개 저장소에 격리 보관하고, 접근 시 만료형 보안 링크를 사용합니다. 자세한
        내용은{' '}
        <a href="/legal/privacy" className="underline">
          개인정보처리방침
        </a>
        을 참고해 주세요.
      </>
    ),
  },
  {
    q: '문의는 어디로 하나요?',
    a: (
      <>
        <a href={TALK_URL} target="_blank" rel="noopener noreferrer" className="underline">
          네이버 톡톡
        </a>
        으로 문의해 주세요.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
        FAQ
      </div>
      <h1 className="mt-2 text-[24px] font-medium tracking-tight text-[var(--wd-ink)] sm:text-[28px]">
        자주 묻는 질문
      </h1>
      <p className="mt-2 text-[14px] leading-[1.75] text-[var(--wd-mute)]">
        알림장 유효기간·영구소장·결제/환불·AI 웨딩스냅 등 자주 묻는 내용을 모았어요.
      </p>

      <div className="mt-8 flex flex-col gap-2">
        {FAQS.map((item) => (
          <details
            key={item.q}
            className="group rounded-lg border border-[var(--wd-line)] bg-white px-4 open:bg-[var(--wd-paper)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-[15px] font-medium text-[var(--wd-ink)] [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden
                className="shrink-0 text-[var(--wd-mute)] transition-transform group-open:rotate-180"
              >
                ⌄
              </span>
            </summary>
            <div className="pb-4 text-[14px] leading-[1.75] text-[var(--wd-mute)]">{item.a}</div>
          </details>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-[var(--wd-mute)]">
        더 궁금한 점은{' '}
        <a
          href={TALK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--wd-ink)]"
        >
          네이버 톡톡
        </a>
        으로 문의해 주세요.
      </p>
    </main>
  );
}
