'use client';

import { useEffect, useState } from 'react';
import type { SampleDesign } from '@/lib/marketing/sample-invitations';
import { InvitationPreview } from './InvitationPreview';
import { OwnerUrlModal } from './OwnerUrlButton';

/** mock 으로 phone 안에서 보여지는 탭들. */
type MockTabId =
  | 'design'
  | 'gallery'
  | 'quiz'
  | 'vote'
  | 'guestbook'
  | 'vow';
/** mock 탭 + 모달만 띄우는 'ownerUrl' 통합 — 같은 list UI 에서 한 줄로 나열. */
type TabId = MockTabId | 'ownerUrl';

const TABS: Array<{ id: TabId; name: string; tag: string }> = [
  { id: 'design', name: '움직이는 디자인', tag: '배경효과·텍스트 애니메이션·폭죽효과' },
  { id: 'gallery', name: '좋아요 가능한 갤러리', tag: '사진마다 하객이 ♥ 좋아요' },
  { id: 'quiz', name: '하객 참여 퀴즈', tag: '객관식 퀴즈로 함께 노는 페이지' },
  { id: 'vote', name: 'A/B 투표', tag: '신혼여행지·드레스 색깔 투표' },
  { id: 'guestbook', name: '소장용 방명록', tag: '축하 메시지 + 손글씨 서명' },
  { id: 'vow', name: '혼인서약서 PDF', tag: '발행 후 마이페이지에서 소장' },
  { id: 'ownerUrl', name: '소장용 URL', tag: '신랑·신부 전용 URL 평생 소장' },
];

/** 자동 순환 대상 — 'ownerUrl' 은 모달이라 제외. */
const MOCK_TAB_IDS: MockTabId[] = [
  'design',
  'gallery',
  'quiz',
  'vote',
  'guestbook',
  'vow',
];

/**
 * "디자인 + 차별화 가치" 통합 쇼케이스.
 *
 * 좌측: 폰 mockup 안에서 탭에 맞춰 mini mock 5 종이 전환됨.
 * 우측: 5 개 탭 — 사용자 클릭으로 즉시 전환, 미클릭 상태에선 5 초마다 자동 순환.
 *
 * mini mock 은 실제 invitation/slides/* 컴포넌트를 직접 임베드하지 않고
 * 마케팅 페이지 안에서만 쓰는 경량 비주얼이다. (실제 슬라이드 컴포넌트는
 * invitationId·서버 API·축하 카운트 등 부수효과가 있어 메인 임베드 부적합.)
 */
export function ShowcaseTabs({
  designs,
  ownerUrlExample,
}: {
  designs: SampleDesign[];
  /** 관리자(/admin/home-samples)에서 세팅한 owner URL 예시. 비면 placeholder. */
  ownerUrlExample?: string;
}) {
  const [active, setActive] = useState<MockTabId>('design');
  const [userPicked, setUserPicked] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const designSamples = designs.slice(0, 4);

  useEffect(() => {
    if (userPicked) return;
    const i = setInterval(() => {
      setActive((prev) => {
        const idx = MOCK_TAB_IDS.indexOf(prev);
        return MOCK_TAB_IDS[(idx + 1) % MOCK_TAB_IDS.length];
      });
    }, 5000);
    return () => clearInterval(i);
  }, [userPicked]);

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-7 sm:grid-cols-[auto_1fr]">
        <div className="flex justify-center py-2">
          <PhoneFrame>
            <MockDesign active={active === 'design'} samples={designSamples} />
            <MockGallery active={active === 'gallery'} />
            <MockQuiz active={active === 'quiz'} />
            <MockVote active={active === 'vote'} />
            <MockGuestbook active={active === 'guestbook'} />
            <MockVowPdf active={active === 'vow'} />
          </PhoneFrame>
        </div>

        <ul className="flex flex-row flex-wrap gap-2 sm:flex-col">
          {TABS.map((t) => {
            const on = t.id !== 'ownerUrl' && t.id === active;
            return (
              <li key={t.id} className="min-w-[150px] flex-1 sm:flex-initial">
                <button
                  type="button"
                  onClick={() => {
                    setUserPicked(true);
                    if (t.id === 'ownerUrl') {
                      // 왼쪽 mock 에 보이지 않고 클릭 즉시 모달 표시.
                      setOwnerOpen(true);
                    } else {
                      setActive(t.id);
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                    on
                      ? 'border-[1.5px] border-[var(--wd-coral)] bg-[var(--wd-cream)]'
                      : 'border-[var(--wd-line)] bg-[var(--wd-paper)] hover:border-[var(--wd-ink)]/30'
                  }`}
                >
                  <TabIcon id={t.id} active={on} />
                  <span className="flex flex-col">
                    <span className="text-[12.5px] font-medium leading-tight text-[var(--wd-ink)]">
                      {t.name}
                    </span>
                    <span className="mt-0.5 text-[10.5px] text-[var(--wd-mute)]">{t.tag}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {ownerOpen && (
        <OwnerUrlModal onClose={() => setOwnerOpen(false)} exampleUrl={ownerUrlExample} />
      )}
    </>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] bg-[#15110E] p-[3px] shadow-[0_14px_40px_rgba(31,27,23,0.18)]">
      {/* 화면 = 정확히 9:18 → InvitationPreview 가 왜곡 없이 가득 채움.
          bg 는 베젤(#15110E) 과 동일하게 — 다크 테마 디자인 표지에서 베젤/스크린
          경계에 흰색 seam(rounded radius 안티에일리어싱) 이 안 보이게. */}
      <div className="relative aspect-[1/2] w-[228px] overflow-hidden rounded-[21px] bg-[#15110E]">
        <div className="absolute left-1/2 top-3 z-30 h-[6px] w-[64px] -translate-x-1/2 rounded-full bg-black/80" />
        {children}
      </div>
    </div>
  );
}

function TabIcon({ id, active }: { id: TabId; active: boolean }) {
  const fill = active ? 'var(--wd-coral)' : 'var(--wd-mute)';
  return (
    <span className="grid h-[26px] w-[18px] flex-shrink-0 place-items-center">
      {id === 'design' && (
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <rect x="2" y="2" width="14" height="18" rx="3" stroke={fill} strokeWidth="1.2" />
          <line x1="5" y1="7" x2="13" y2="7" stroke={fill} strokeWidth="1.2" />
          <line x1="5" y1="11" x2="11" y2="11" stroke={fill} strokeWidth="1.2" />
        </svg>
      )}
      {id === 'gallery' && (
        // 사진 + 하트 (좋아요 가능한 갤러리)
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <rect x="2" y="4" width="14" height="11" rx="2" stroke={fill} strokeWidth="1.2" />
          <circle cx="6" cy="8" r="1.3" stroke={fill} strokeWidth="1.2" />
          <path d="M3 14l4-3.5 3 2.5 2.5-2L15 13" stroke={fill} strokeWidth="1.2" strokeLinejoin="round" />
          <path
            d="M9 20.5c-2.4-1.7-3.6-3-3.6-4.3a1.7 1.7 0 0 1 3-1.1 1.7 1.7 0 0 1 3 1.1c0 1.3-1.2 2.6-3.4 4.3z"
            fill={fill}
          />
        </svg>
      )}
      {id === 'quiz' && (
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <circle cx="9" cy="9" r="7" stroke={fill} strokeWidth="1.2" />
          <path
            d="M9 12v-1c0-1 .5-1.5 1.5-2s1.5-1 1.5-2A3 3 0 1 0 6 7"
            stroke={fill}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="9" cy="15" r="0.7" fill={fill} />
        </svg>
      )}
      {id === 'vote' && (
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <rect x="2" y="3" width="6" height="14" rx="1" stroke={fill} strokeWidth="1.2" />
          <rect x="10" y="7" width="6" height="10" rx="1" stroke={fill} strokeWidth="1.2" />
        </svg>
      )}
      {id === 'guestbook' && (
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <path
            d="M3 4h12v12H6l-3 3V4z"
            stroke={fill}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <line x1="6" y1="8" x2="12" y2="8" stroke={fill} strokeWidth="1.2" />
          <line x1="6" y1="11" x2="10" y2="11" stroke={fill} strokeWidth="1.2" />
        </svg>
      )}
      {id === 'vow' && (
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <path
            d="M4 2h7l3 3v15H4V2z"
            stroke={fill}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path d="M11 2v3h3" stroke={fill} strokeWidth="1.2" />
          <line x1="6" y1="10" x2="12" y2="10" stroke={fill} strokeWidth="1.2" />
          <line x1="6" y1="13" x2="12" y2="13" stroke={fill} strokeWidth="1.2" />
          <line x1="6" y1="16" x2="10" y2="16" stroke={fill} strokeWidth="1.2" />
        </svg>
      )}
      {id === 'ownerUrl' && (
        // 자물쇠(소장 = 두 사람만의 잠긴 URL) 아이콘
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <rect x="3" y="9" width="12" height="9" rx="1.4" stroke={fill} strokeWidth="1.2" />
          <path
            d="M6 9V6.5a3 3 0 0 1 6 0V9"
            stroke={fill}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="9" cy="13" r="1.1" fill={fill} />
        </svg>
      )}
    </span>
  );
}

/* ─────────────────── mini mock 6 종 ─────────────────── */

// 디자인 탭은 실제 알림장 렌더러로 만든 표지를 순환 (나머지 탭은 경량 mock 유지).
function MockDesign({ active, samples }: { active: boolean; samples: SampleDesign[] }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    if (!active || samples.length <= 1) return;
    const i = setInterval(() => setD((v) => (v + 1) % samples.length), 3200);
    return () => clearInterval(i);
  }, [active, samples.length]);

  const cur = samples[d % samples.length];

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      {cur && (
        <div key={cur.id} className="absolute inset-0" style={{ animation: 'wd-fade 0.6s ease' }}>
          <InvitationPreview design={cur} cover />
        </div>
      )}
    </div>
  );
}

function MockGallery({ active }: { active: boolean }) {
  // 사진 타일 2×2 — 각 타일에 ♥ 좋아요 배지. 한 장은 '좋아요 누른' 상태(코랄 채움).
  const tiles = [
    { from: '#E8C8B8', to: '#C9748E', likes: 24, liked: true },
    { from: '#C9D2BD', to: '#658067', likes: 12, liked: false },
    { from: '#D7C9EA', to: '#8E6FBF', likes: 31, liked: false },
    { from: '#F5DCC4', to: '#B8915A', likes: 18, liked: true },
  ];
  return (
    <div
      className={`absolute inset-0 flex flex-col bg-[var(--wd-paper)] px-4 pb-4 pt-9 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="font-italiana text-[10px] tracking-[0.3em] text-[var(--wd-coral)]">
        GALLERY
      </div>
      <div className="mt-1 text-[12px] text-[var(--wd-mute)]">
        사진마다 하객이 <span className="text-[var(--wd-coral)]">♥</span> 좋아요
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {tiles.map((t, i) => (
          <div
            key={i}
            className="relative aspect-[3/4] overflow-hidden rounded-xl"
            style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
          >
            {/* 좋아요 배지 */}
            <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
              <span className={t.liked ? 'text-[var(--wd-coral)]' : 'text-white'}>♥</span>
              {t.likes}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockQuiz({ active }: { active: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col justify-center bg-[var(--wd-paper)] px-5 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="font-italiana text-[10px] tracking-[0.3em] text-[var(--wd-coral)]">
        QUIZ · 01 / 02
      </div>
      <div className="mt-3 text-[15px] font-medium leading-snug text-[var(--wd-ink)]">
        두 사람이 처음 만난 곳은?
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {['대학교 동아리', '회사 워크샵', '소개팅 앱', '친구 결혼식'].map((label, i) => (
          <div
            key={i}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-[12px] ${
              i === 1
                ? 'border-[var(--wd-coral)] bg-[var(--wd-cream)] text-[var(--wd-ink)]'
                : 'border-[var(--wd-line)] text-[var(--wd-mute)]'
            }`}
          >
            <span>{label}</span>
            {i === 1 && (
              <span className="text-[10px] font-medium text-[var(--wd-coral)]">✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockVote({ active }: { active: boolean }) {
  const A = 62;
  const B = 38;
  return (
    <div
      className={`absolute inset-0 flex flex-col justify-center bg-[var(--wd-paper)] px-5 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="font-italiana text-[10px] tracking-[0.3em] text-[var(--wd-coral)]">
        A / B VOTE
      </div>
      <div className="mt-3 text-[15px] font-medium leading-snug text-[var(--wd-ink)]">
        신혼여행은 어디로?
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <VoteRow label="A · 발리" pct={A} highlight />
        <VoteRow label="B · 제주" pct={B} />
      </div>
    </div>
  );
}

function VoteRow({ label, pct, highlight }: { label: string; pct: number; highlight?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-[var(--wd-mute)]">
        <span className="text-[var(--wd-ink)]">{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--wd-line)]">
        {/* 비강조 막대도 솔리드 색으로 — 기존 /60 반투명은 옅은 트랙 위에서 거의
            안 보여 '안 채워진' 것처럼 보였다. 비율(width)만큼 또렷이 채운다. */}
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${
            highlight ? 'bg-[var(--wd-coral)]' : 'bg-[var(--wd-ink)]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// 실제 소장용 URL 의 방명록 페이지(흰 책장 카드 — 한 사람의 메시지 + 손글씨 서명을
// 한 장에, 넘기면 다음 사람)를 그대로 본떠 보여 준다. active 일 때 자동으로 다음 장으로.
function MockGuestbook({ active }: { active: boolean }) {
  const entries = [
    { name: '지원 누나', side: '신부측', date: '2026.06.02', body: '드디어! 정말 축하해요 ❤︎ 두 사람 오래오래 행복하게 잘 살아요.' },
    { name: '재현 형', side: '신랑측', date: '2026.06.01', body: '두 사람 정말 잘 어울려요. 결혼 진심으로 축하합니다.' },
    { name: '하은', side: '신부측', date: '2026.05.30', body: '결혼식 못 가서 미안해. 신혼여행 사진 잔뜩 보여줘!' },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setI((v) => (v + 1) % entries.length), 3200);
    return () => clearInterval(t);
  }, [active, entries.length]);
  const cur = entries[i];

  return (
    <div
      className={`absolute inset-0 flex flex-col bg-[var(--wd-paper)] px-4 pb-4 pt-9 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="font-italiana text-[10px] tracking-[0.3em] text-[var(--wd-coral)]">
        GUESTBOOK
      </div>
      <div className="mt-1 text-[12px] text-[var(--wd-mute)]">받은 메시지 · 손글씨 서명</div>

      <div className="mt-3 flex flex-1 flex-col">
        {/* 흰 책장 카드 — 한 사람분 (이름·날짜 / 메시지 / 손글씨 서명) */}
        <div
          key={i}
          className="flex flex-1 flex-col gap-2 rounded-lg bg-white p-3 shadow-[0_8px_20px_rgba(31,27,23,0.12)] ring-1 ring-[var(--wd-line)]"
          style={{ animation: 'wd-fade 0.5s ease' }}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-[var(--wd-ink)]">
              {cur.name} <span className="text-[9px] font-normal text-[var(--wd-mute)]">· {cur.side}</span>
            </span>
            <span className="text-[9px] text-[var(--wd-mute)]">{cur.date}</span>
          </div>
          <p className="text-[11px] leading-snug text-[var(--wd-ink)]/85">{cur.body}</p>
          <div className="mt-auto border-t border-[var(--wd-line)] pt-1.5">
            <p className="text-[8.5px] text-[var(--wd-mute)]">손글씨 서명</p>
            <SignatureScribble seed={i} />
          </div>
        </div>

        {/* 페이지 인디케이터 — 넘겨 보는 책 느낌 */}
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {entries.map((_, di) => (
            <span
              key={di}
              className="h-1 rounded-full transition-all"
              style={{
                width: di === i ? 12 : 4,
                backgroundColor: di === i ? 'var(--wd-coral)' : 'var(--wd-line)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 손글씨 서명 느낌의 흘림 스크리블 — seed 로 약간씩 다른 모양. */
function SignatureScribble({ seed }: { seed: number }) {
  const paths = [
    'M4 16 C12 4, 20 22, 30 10 S 48 6, 62 16 70 12, 82 14',
    'M6 14 C16 6, 22 20, 34 12 S 50 18, 60 10 72 16, 82 12',
    'M4 12 C14 20, 24 4, 36 14 S 52 8, 64 16 74 10, 82 15',
  ];
  return (
    <svg viewBox="0 0 88 22" className="mt-0.5 h-6 w-[88px]" fill="none" aria-hidden>
      <path
        d={paths[seed % paths.length]}
        stroke="var(--wd-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.72"
      />
    </svg>
  );
}

// 실제 혼인서약서(certificate-view)를 그대로 축소한 미니 카드 — 크림 배경 +
// 코랄 이중 외곽선 + MARRIAGE VOW 키커 + 청연체 서명 + 하단 QR.
function MockVowPdf({ active }: { active: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#EFEAE0] px-4 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="relative w-[152px] bg-[#FFFCF7] px-4 py-5 shadow-[0_16px_34px_rgba(31,27,23,0.2)]">
        {/* 코랄 이중 외곽선 */}
        <div aria-hidden className="pointer-events-none absolute inset-[6px] border border-[var(--wd-coral)]" />
        <div aria-hidden className="pointer-events-none absolute inset-[9px] border border-[var(--wd-coral)]/30" />
        <div className="relative flex flex-col items-center gap-2 text-center">
          <p className="text-[5.5px] font-semibold tracking-[0.38em] text-[var(--wd-coral)]">
            MARRIAGE VOW
          </p>
          <h4
            className="text-[13px] font-bold tracking-[0.3em] text-[var(--wd-ink)]"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            혼인서약서
          </h4>
          <div className="mt-1 flex flex-col gap-1 text-[6.5px] leading-[1.7] text-[var(--wd-ink)]/85">
            <p>
              오늘부터 우리 두 사람은
              <br />
              서로의 일상이 되어 함께합니다.
            </p>
            <p className="text-[var(--wd-mute)]">
              서로의 가장 가까운 친구가 되겠습니다.
              <br />
              함께하는 매일을 소중히 여기겠습니다.
            </p>
          </div>
          <p className="text-[6px] tracking-[0.2em] text-[var(--wd-mute)]">2026년 6월 15일</p>
          <div className="mt-0.5 flex w-full items-end justify-around">
            <MiniSign label="신 랑" name="민준" />
            <MiniSign label="신 부" name="서연" />
          </div>
          <div className="mt-1 flex flex-col items-center gap-0.5">
            <div className="grid grid-cols-5 gap-px border border-[var(--wd-coral)] bg-white p-[2px]">
              {MOCK_QR_CELLS.map((on, k) => (
                <span
                  key={k}
                  className="h-[2px] w-[2px]"
                  style={{ backgroundColor: on ? 'var(--wd-ink)' : 'transparent' }}
                />
              ))}
            </div>
            <span className="text-[4.5px] tracking-[0.18em] text-[var(--wd-mute)]">모바일 알림장</span>
          </div>
        </div>
      </div>

      <div className="text-center text-[10.5px] leading-snug text-[var(--wd-ink)]">
        발행 후 마이페이지에서{' '}
        <span className="text-[var(--wd-coral)]">PDF · 이미지</span> 로 다운로드
      </div>
    </div>
  );
}

// 가짜 QR 패턴(5×5) — 실제 QR 느낌만 주는 장식.
const MOCK_QR_CELLS = [
  1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1,
].map(Boolean);

function MiniSign({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[5px] tracking-[0.2em] text-[var(--wd-mute)]">{label}</span>
      <span
        className="text-[11px] leading-none text-[var(--wd-ink)]"
        style={{ fontFamily: 'var(--font-gabia-cheongyeon), serif' }}
      >
        {name}
      </span>
      <span className="mt-0.5 block h-px w-8 bg-[var(--wd-ink)]/70" />
    </div>
  );
}
