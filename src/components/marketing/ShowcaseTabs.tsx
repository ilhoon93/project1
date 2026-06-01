'use client';

import { useEffect, useState } from 'react';
import type { SampleDesign } from '@/lib/marketing/sample-invitations';
import { InvitationPreview } from './InvitationPreview';
import { OwnerUrlModal } from './OwnerUrlButton';

/** mock 으로 phone 안에서 보여지는 탭들. */
type MockTabId =
  | 'design'
  | 'bgm'
  | 'video'
  | 'quiz'
  | 'vote'
  | 'guestbook'
  | 'account'
  | 'vow';
/** mock 탭 + 모달만 띄우는 'ownerUrl' 통합 — 같은 list UI 에서 한 줄로 나열. */
type TabId = MockTabId | 'ownerUrl';

const TABS: Array<{ id: TabId; name: string; tag: string }> = [
  { id: 'design', name: '움직이는 디자인', tag: '폰트·애니메이션·일러스트' },
  { id: 'bgm', name: '배경음악', tag: '우리 분위기에 맞는 BGM' },
  { id: 'video', name: '영상 슬라이드', tag: '사진뿐 아니라 영상까지' },
  { id: 'quiz', name: '하객 참여 퀴즈', tag: '객관식 퀴즈로 함께 노는 페이지' },
  { id: 'vote', name: 'A/B 투표', tag: '신혼여행지·드레스 색깔 투표' },
  { id: 'guestbook', name: '소장용 방명록', tag: '축하 메시지 + 손글씨 서명' },
  { id: 'account', name: '마음 전달', tag: '복사 한 번에 계좌 전송' },
  { id: 'vow', name: '혼인서약서 PDF', tag: '발행 후 마이페이지에서 소장' },
  { id: 'ownerUrl', name: '소장용 URL', tag: '신랑·신부 전용 URL 평생 소장' },
];

/** 자동 순환 대상 — 'ownerUrl' 은 모달이라 제외. */
const MOCK_TAB_IDS: MockTabId[] = [
  'design',
  'bgm',
  'video',
  'quiz',
  'vote',
  'guestbook',
  'account',
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
            <MockBgm active={active === 'bgm'} />
            <MockVideo active={active === 'video'} />
            <MockQuiz active={active === 'quiz'} />
            <MockVote active={active === 'vote'} />
            <MockGuestbook active={active === 'guestbook'} />
            <MockAccount active={active === 'account'} />
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
      {id === 'bgm' && (
        // 음표 (배경음악)
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <path
            d="M7 14V5l8-1.5V12"
            stroke={fill}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="5" cy="14.5" r="2" stroke={fill} strokeWidth="1.2" />
          <circle cx="13" cy="12.5" r="2" stroke={fill} strokeWidth="1.2" />
        </svg>
      )}
      {id === 'video' && (
        // 재생 버튼 (영상 슬라이드)
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <rect x="2" y="5" width="14" height="12" rx="2" stroke={fill} strokeWidth="1.2" />
          <path d="M7.5 8.5l4 2.5-4 2.5V8.5z" fill={fill} />
        </svg>
      )}
      {id === 'account' && (
        // 봉투/하트 (마음 전달 · 계좌)
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <rect x="2" y="5" width="14" height="11" rx="2" stroke={fill} strokeWidth="1.2" />
          <path d="M2.5 6l6.5 4.5L15.5 6" stroke={fill} strokeWidth="1.2" strokeLinejoin="round" />
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

/* ─────────────────── mini mock 5 종 ─────────────────── */

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

function MockBgm({ active }: { active: boolean }) {
  // 파형 막대 — active 일 때만 isactive animation 으로 살아 움직이게.
  const bars = [10, 22, 14, 28, 18, 32, 16, 24, 12, 26, 20, 30, 14, 22];
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#241C16] to-[#15110E] px-6 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="font-italiana text-[10px] tracking-[0.3em] text-[var(--wd-coral)]">
        BACKGROUND MUSIC
      </div>
      {/* 앨범아트 */}
      <div className="mt-4 grid h-[96px] w-[96px] place-items-center rounded-2xl bg-[var(--wd-coral)]/20 ring-1 ring-white/10">
        <svg width="40" height="40" viewBox="0 0 18 22" fill="none">
          <path
            d="M7 14V5l8-1.5V12"
            stroke="var(--wd-cream)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="5" cy="14.5" r="2" stroke="var(--wd-cream)" strokeWidth="1.2" />
          <circle cx="13" cy="12.5" r="2" stroke="var(--wd-cream)" strokeWidth="1.2" />
        </svg>
      </div>
      <div className="mt-4 text-[12.5px] font-medium text-[var(--wd-cream)]">
        우리 둘의 테마곡
      </div>
      {/* 파형 */}
      <div className="mt-4 flex h-[34px] items-end gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[3px] origin-bottom rounded-full bg-[var(--wd-coral)]/80"
            style={{
              height: `${h}px`,
              animation: active ? `wd-eq 0.9s ease-in-out ${i * 0.06}s infinite alternate` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MockVideo({ active }: { active: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-[#15110E] px-5 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="font-italiana text-[10px] tracking-[0.3em] text-[var(--wd-coral)]">
        OUR FILM
      </div>
      {/* 세로 영상 프레임 + 재생 버튼 */}
      <div className="relative mt-4 h-[230px] w-[150px] overflow-hidden rounded-xl bg-gradient-to-br from-[#3a2e25] via-[#2a211b] to-[#15110E] ring-1 ring-white/10">
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 shadow-lg">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M5 3.5l7 4.5-7 4.5v-9z" fill="var(--wd-ink)" />
            </svg>
          </span>
        </div>
        {/* progress */}
        <div className="absolute inset-x-3 bottom-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/25">
            <div className="h-full w-1/3 rounded-full bg-[var(--wd-coral)]" />
          </div>
        </div>
      </div>
      <div className="mt-3 text-[11px] leading-snug text-[var(--wd-cream)]">
        사진뿐 아니라 <span className="text-[var(--wd-coral)]">영상</span> 한 컷까지
      </div>
    </div>
  );
}

function MockAccount({ active }: { active: boolean }) {
  const rows = [
    { side: '신랑', bank: '우리은행', num: '1002-•••-••4567' },
    { side: '신부', bank: '카카오뱅크', num: '3333-••-•••8901' },
  ];
  return (
    <div
      className={`absolute inset-0 flex flex-col justify-center bg-[var(--wd-paper)] px-5 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="font-italiana text-[10px] tracking-[0.3em] text-[var(--wd-coral)]">
        WITH HEART
      </div>
      <div className="mt-2 text-[14px] font-medium leading-snug text-[var(--wd-ink)]">
        마음 전하실 곳
      </div>
      <div className="mt-1 text-[11px] text-[var(--wd-mute)]">
        복사 한 번이면 계좌번호 전송 완료
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-[var(--wd-line)] bg-[var(--wd-cream)] px-3 py-2.5"
          >
            <div className="flex flex-col text-left">
              <span className="text-[10px] tracking-wider text-[var(--wd-coral)]">
                {r.side}
              </span>
              <span className="text-[11.5px] font-medium text-[var(--wd-ink)]">
                {r.bank}
              </span>
              <span className="text-[10.5px] text-[var(--wd-mute)]">{r.num}</span>
            </div>
            <span className="rounded-full bg-[var(--wd-ink)] px-2.5 py-1 text-[10px] font-medium text-[var(--wd-cream)]">
              복사
            </span>
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
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--wd-line)]">
        <div
          className={`h-full rounded-full ${highlight ? 'bg-[var(--wd-coral)]' : 'bg-[var(--wd-ink)]/60'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MockGuestbook({ active }: { active: boolean }) {
  const items = [
    { name: '지원 누나', body: '드디어! 정말 축하해요 ❤︎', tag: '서명' },
    { name: '재현 형', body: '두 사람 잘 어울려요. 오래 행복하길.' },
    { name: '하은', body: '결혼식 못 가서 미안. 사진 잔뜩 부탁!' },
  ];
  return (
    <div
      className={`absolute inset-0 flex flex-col bg-[var(--wd-paper)] px-4 pb-4 pt-9 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="font-italiana text-[10px] tracking-[0.3em] text-[var(--wd-coral)]">
        GUESTBOOK
      </div>
      <div className="mt-1 text-[12px] text-[var(--wd-mute)]">축하 메시지 & 손글씨 서명</div>
      <div className="mt-3 flex flex-1 flex-col gap-2 overflow-hidden">
        {items.map((it, i) => (
          <div
            key={i}
            className="rounded-xl bg-[var(--wd-cream)] px-3 py-2.5 text-[11px] text-[var(--wd-ink)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-medium">{it.name}</span>
              {it.tag && (
                <span className="rounded-full bg-[var(--wd-coral)]/15 px-1.5 py-px text-[8.5px] tracking-wider text-[var(--wd-coral)]">
                  {it.tag}
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] leading-snug text-[var(--wd-mute)]">{it.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockVowPdf({ active }: { active: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-[#EFEAE0] px-4 transition-opacity duration-500 ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      {/* PDF 종이 mock */}
      <div className="relative h-[260px] w-[160px] rotate-[-3deg] bg-white p-4 shadow-[0_18px_36px_rgba(31,27,23,0.18)]">
        <div className="font-italiana text-center text-[10px] tracking-[0.32em] text-[var(--wd-coral)]">
          MARRIAGE VOW
        </div>
        <div className="mt-1 text-center text-[9px] tracking-[0.18em] text-[var(--wd-mute)]">
          혼인서약서
        </div>
        <div className="mt-3 space-y-1.5">
          {[100, 92, 96, 84, 100, 78, 90, 100, 88].map((w, i) => (
            <div
              key={i}
              className="h-[3px] rounded-full bg-[var(--wd-ink)]/15"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-between text-[9px] text-[var(--wd-mute)]">
          <div>
            <div className="text-[var(--wd-ink)]">민준</div>
            <div className="mt-1 h-[20px] w-[44px] border-b border-[var(--wd-ink)]/40" />
          </div>
          <div>
            <div className="text-[var(--wd-ink)]">서연</div>
            <div className="mt-1 h-[20px] w-[44px] border-b border-[var(--wd-ink)]/40" />
          </div>
        </div>
        <div className="mt-3 text-center text-[8px] tracking-wider text-[var(--wd-mute)]">
          2025 · 06 · 15
        </div>
      </div>
      <div className="mt-5 text-center text-[10.5px] leading-snug text-[var(--wd-ink)]">
        발행 후 마이페이지에서
        <br />
        <span className="text-[var(--wd-coral)]">PDF · 이미지</span> 로 다운로드
      </div>
    </div>
  );
}
