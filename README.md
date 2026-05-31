# 우리다운 — 웨딩 알림장 스튜디오

노웨딩·스몰웨딩에 어울리는 모바일 우선 청첩장(알림장) 빌더. 신랑신부가 직접
디자인을 고르고, AI 가 메인 사진을 만들어 주고, 발행 후엔 하객용/소장용 두
가지 URL 로 나눠 공유한다.

## 핵심 흐름

```
네이버 로그인 (자동 로그인 토글)
   → 알림장 생성 (계정당 최대 10개)
   → 11개 슬라이드 편집 (메인 / 기본정보 / 스토리 / 갤러리 / 영상 /
                         퀴즈 / 투표 / 방명록 / 계좌 / 마무리)
   → AI 컨셉 이미지 생성 (계정당 1회 무료, fal.ai 큐 모드)
   → 데스크톱: 좌측 실시간 미리보기 / 모바일: 별도 미리보기 페이지
   → 발행권 1개 차감해 "발행"
        ↓
   하객용 URL : /<slug>             — 사람들에게 배포
   소장용 URL : /<slug>/o/<token>   — 신랑신부 본인 전용 (메시지·서명·통계)
        ↓
   하객 진입: 축하하기 카운트 ↑, 갤러리 사진 좋아요 ↑, 퀴즈/투표/방명록 작성
   소장용 진입: 진입 시 컨페티 자동 + "총 N번의 축하" 카운트
              · 갤러리 사진별 좋아요 통계
              · 퀴즈/투표 응답 분포 막대 그래프
              · 방명록·서명 책 페이지 넘기기 뷰
        ↓
   영구소장 패키지를 결제하면 소장용 URL 의 30일 만료를 영구로 전환
```

기본 만료 정책:
- 미발행 + 14일 미수정 → 알림장 자동 삭제 (cron)
- 발행 후 → **결혼식 날짜 + 30일** 후 URL 만료 (영구소장 적용 시 owner URL 만 영구)
- 30분 유휴 또는 로그인 시 "자동 로그인" 미체크 → 자동 로그아웃

## 스택

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | Next.js 14 (App Router) · TypeScript · Tailwind CSS v3 · shadcn/ui (classic) |
| 상태 | Zustand (편집기, persist) · framer-motion (슬라이드 전환) |
| 백엔드 | Supabase Postgres · RLS · Storage · service-role admin client |
| 인증 | Supabase Auth + 네이버 OAuth 브릿지 (`/api/auth/naver/*`) |
| AI 컨셉 이미지 | fal.ai 큐 모드 — `openai/gpt-image-2/edit` (메인 사진 보정) |
| AI 웨딩스냅 | fal.ai 큐 모드 — `openai/gpt-image-2/edit` + 4단 후처리 (harmonize · img2img finishing · 업스케일 · sharpen) |
| 이미지 처리 | `sharp` (LAB 분석 · 색매칭 · sharpen · JPEG mozjpeg) |
| PDF | `pdf-lib` + `@pdf-lib/fontkit` + 런타임 한글 폰트 (Noto Serif KR) |
| 결제 | PortOne V2 + Toss Payments 채널 / 네이버 스마트스토어 주문번호 등록 |
| 호스팅 | Vercel (Hobby 60s 함수 제한 호환) |

## 슬라이드 / 편집기 한눈에

| 슬라이드 | 주요 기능 |
| --- | --- |
| **메인** | 4가지 레이아웃: 포스터(풀이미지) · 액자프레임(폴라로이드/하트/스크린) · 일러스트(아치/슬로우 댄스) · 텍스트 — 글자 크기/색·위치 슬라이더 + 이미지 위치(크롭) 슬라이더 + 9:20 폰 크롭 안내 |
| **기본정보** | 글귀·인사말·가족(부모/故 표시)·결혼식 날짜 — ↑↓ 으로 영역 순서 변경 |
| **스토리** | 챕터 최대 5개 (제목·사진·내용) |
| **갤러리** | 슬라이드형(중앙 + 5장 썸네일) / 그리드형(상단 큰 사진 + 그리드). 사진별 하트 ❤ 좋아요 (애니메이션 + DB 카운트) |
| **영상** | YouTube/Vimeo/Shorts 임베드 + 자체 호스팅 mp4. 자동 비율 감지 — 가로/세로 영상 모두 잘림 없이. 영상 위에는 배경 효과 차단(z-20) |
| **퀴즈** | 4지선다 최대 2문항 |
| **투표** | 2지선다 최대 2문항 |
| **방명록** | 비공개 메시지 + 옵션 서명. 어두운 테마에서도 가독성 유지된 흰 입력칸. 서명은 portal 모달로 분리 |
| **계좌** | 신랑/신부/부모 6 측별 계좌 최대 3개. 기본정보 이름 자동 매핑. 축의금 사양 톤 안내문구 추천 포함 |
| **마무리** | 노웨딩 톤 추천 인사말 5종 |

추천 문구 콤보박스 (`PresetTextArea`) — 메인 인사말, 기본정보 인사말/글귀,
방명록, 계좌 안내, 마무리 인사 5곳에서 사용. portal 로 body 에 렌더되어 잘림
없음, 화면 아래 공간이 부족하면 자동 위쪽으로 펼침 (flip-up).

## 디자인 테마

- 색상: 크림 / 블러쉬 / 세이지 / 라벤더 / 하늘(그라데이션) / 펄 / 편지지 / 샴페인 / 로즈 / 포레스트 / 차콜 / 더스크 / 미드나잇 / 네이비 — 14종
- 배경 효과: 꽃잎 / 하트 / 별 / 벚꽃잎(질감) / 단풍잎(질감) / 흰 꽃잎(실사풍) / **별빛(트윙클 + 오로라)** / **보케(블러 원)** / 없음
- 폰트: 명조/고딕/나눔/프리텐다드/제주 외 한글 다수 + 메인 제목 영문 폰트 6종 (Playfair Display 등)

마케팅 디자인 카탈로그 (`/designs`) — 위 색상·효과·레이아웃·폰트 조합으로 만든
**15종 풀스크린 샘플** (`src/lib/marketing/sample-invitations.ts:SEEDS`). 사용자가
카드를 누르면 폰 프레임 모달에서 슬라이드 전체를 둘러볼 수 있고, "비슷하게 만들기"
를 누르면 `/new?preset=<id>` 로 진입해 그 디자인의 컬러·펄·폰트·레이아웃 +
신랑·신부 이름·날짜·인사말까지 시작값으로 채워진 빈 알림장이 생성됨.

## URL 구조

| 페이지 | 경로 | 누가 보는가 |
| --- | --- | --- |
| 랜딩 | `/` | 누구나 |
| 디자인 카탈로그 | `/designs` | 누구나 (15종 샘플 풀스크린 미리보기 + "비슷하게 만들기" 진입) |
| AI 웨딩스냅 안내 | `/wedding-snap` | 누구나 (카탈로그 갤러리 + 진행 방법) |
| 로그인 | `/login` | 비로그인 |
| 마이페이지 | `/mypage` | 본인 |
| 알림장 편집 | `/edit/[id]` | 본인 |
| 미리보기 (모바일) | `/preview/[id]` | 본인 |
| 결제 | `/purchase/[id]` | 본인 |
| **하객용 알림장** | `/[slug]` | 누구나 (만료 전) |
| **신랑신부 소장용** | `/[slug]/o/[token]` | URL 아는 사람 (영구소장 적용 시 만료 없음) |

## 결제 패키지

2026-05 가격 정책 (migration `035_pricing_2026_05.sql` 기준).

### 알림장 / 영구소장

| 코드 | 이름 | 가격 | 지급 |
| --- | --- | --- | --- |
| `basic` | 알림장 | 9,900원 | 발행권 +2 |
| `archive_basic` | 영구소장 | 3,000원 | 영구소장권 +2 (소장용 URL 영구 보관) |

### AI 웨딩스냅 크레딧 패키지

| 코드 | 이름 | 가격 | 크레딧 | 무료 재생성 |
| --- | --- | --- | --- | --- |
| `snap_5` | 체험팩 | 7,900원 | 5장 | 1회 |
| `snap_10` | 소형 | 12,900원 | 10장 | 2회 |
| `snap_20` | 표준 (추천) | 19,900원 | 20장 | 4회 |
| `snap_40` | 헤비 | 29,900원 | 40장 | 8회 |
| `snap_10_bundle` | 알림장 번들 10장 | 9,900원 | 10장 | 2회 |

- `snap_10_bundle` 은 `basic` 결제와 묶음 한정 — 단독 `snap_10` 대비 3,000원 할인.
- 발행권/영구소장권/스냅 크레딧은 모두 **ledger 테이블**(누적 ±) 로 관리.
- 마이페이지 → 발행권·영구소장 탭에서 보유 잔량과 잠금해제 패키지를 확인할 수 있다.
- 가격·크레딧 단일 소스 : `src/lib/snap/packages.ts` + `supabase/migrations/035_pricing_2026_05.sql`.

## 데이터 수집 정책

- **에디터 미리보기 단계** → 어떤 카운트도 서버에 기록되지 않는다 (`isPreview` 분기).
- **발행 이후 하객용/소장용 진입** → 카운트·메시지·통계가 수집되고 소장용 뷰에서만 공개.
- 하객용 URL 에서는 메시지/통계/서명을 **다른 하객에게 보여주지 않는다** (전부 비공개).

## AI 이미지 생성 (큐 모드)

`fal.subscribe` 의 60초+ 블로킹 호출은 Vercel Hobby 60s 제한과 충돌해
`Unexpected token 'A'…` 에러가 났다. 큐 모드로 분리.

```
POST /api/ai/concept-generate         (1–3초)  → fal.queue.submit
GET  /api/ai/concept-status?id=...    (≤1초)   → 5초 간격 폴링 (최대 5분)
POST /api/ai/concept-finalize         (3–5초)  → 결과 저장 + 사용량 +1
```

- 각 호출이 5초 안쪽이라 Hobby 60s 제한과 무관.
- 진행 중 `requestId` 는 `sessionStorage` 에 저장 → 새로고침 시 자동으로 폴링 재개.
- 사용량은 finalize 성공 시에만 +1 — 도중에 닫혀도 손해 없음.
- 5가지 컨셉 (실내 스튜디오 / 푸른 하늘과 초원 / 한옥 예식장 / 도심 속 / 바닷가).

자세한 설치는 [docs/ai-concept-image-setup.md](docs/ai-concept-image-setup.md).

## AI 웨딩스냅 (앵커 + 카탈로그 + 4단 후처리)

`ai_snap` 패키지 보유 사용자가 셀카로 만든 신랑·신부 앵커 + 카탈로그 마스터를
조합해 웨딩 컨셉별 합성 사진을 생성한다. 큐 모드 + 비동기 finalize 라 사용자는
페이지를 떠나도 됨 (마이페이지 진입 시 일괄 처리).

### 큐 흐름

```
POST /api/snap/generate         → fal.queue.submit (gpt-image-2/edit)
                                   - 카탈로그 컬러 메타 사전 추출 + 프롬프트 동적 주입
                                   - snap 크레딧 1 차감 (RPC consume_snap_credit)
                                   - snap_jobs INSERT (status='submitted')
GET  /api/snap/status?id=...    → 폴링 (5s 간격)
POST /api/snap/finalize         → fal.queue.result + 4단 후처리 + storage 업로드
                                   - 또는 /api/snap/jobs/poll-pending 으로 mypage 진입 시 일괄
```

### 4단 후처리 파이프라인 (카탈로그 결과 한정)

| 단계 | 모듈 | 동작 | env flag |
|---|---|---|---|
| 1. Harmonize | `lib/snap/harmonize.ts` | birefnet 마스크 + LAB 색매칭 (배경 강하게, 사람 약하게) | `SNAP_HARMONIZE_MODE` |
| 2. Finishing | `lib/snap/finishing.ts` | flux/dev img2img strength 0.2 마감 패스 | `SNAP_FINISHING_MODE` |
| 3. Upscale | `lib/snap/postprocess.ts` | aura-sr / Topaz 2x | `SNAP_UPSCALE_MODE` |
| 4. Sharpen | sharp 로컬 | unsharp mask + JPEG mozjpeg | (자동) |

각 단계 실패 시 직전 결과로 graceful fallback — 후처리 실패가 finalize 를 깨뜨리지 않음.

### 카탈로그
- 10종 (studio · outdoor · tradition · urban · beach)
- Personality: `together` / `groom-solo` / `bride-solo`
- 정적 자산: `public/wedding-snap/catalog/{id}.jpg` (1024×1536 권장)

자세한 흐름·비용·운영 가이드는 [docs/wedding-snap-pipeline.md](docs/wedding-snap-pipeline.md).

## 혼인서약서 PDF

발행된 알림장이 있는 사용자는 마이페이지에서 **혼인서약서 PDF** 를
다운로드할 수 있다.

- `pdf-lib` + `@pdf-lib/fontkit`
- jsDelivr 의 Noto Serif KR TTF 를 런타임 fetch + 모듈 변수에 캐시
- A4 한 장: 외곽 이중 테두리 / 제목 / 신랑·신부·날짜 / 본문 6줄 / 서명란

자세한 라우트는 [src/app/api/invitations/\[id\]/certificate/route.ts](src/app/api/invitations/[id]/certificate/route.ts).

## 셋업

### 1. 의존성

```bash
npm install
```

### 2. 환경 변수

```bash
cp .env.local.example .env.local
```

`.env.local` 의 주요 키:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`
- `FAL_KEY` (AI 컨셉 이미지 + AI 웨딩스냅 공유)
- `SNAP_HARMONIZE_MODE` / `SNAP_FINISHING_MODE` / `SNAP_UPSCALE_MODE` (웨딩스냅 후처리 토글, 선택)
- `PORTONE_*`, `NAVER_COMMERCE_*` (선택)
- `NEXT_PUBLIC_BASE_URL` (운영 도메인)
- `CRON_SECRET` (14일 미발행 정리 cron)

전체 환경 변수 + 기본값 + 운영 권장값 일람: [docs/env-variables.md](docs/env-variables.md)

코드의 모든 Supabase 클라이언트는 [src/lib/env.ts](src/lib/env.ts) 의
`requireEnv()` 로 lazy-evaluated 환경변수를 읽어 빌드 시점이 아닌 런타임에 검사.

### 3. 데이터베이스 마이그레이션

```bash
npx supabase db push
```

또는 Supabase Dashboard SQL Editor 에서 순서대로 실행:

1. `001_initial.sql` — 기본 테이블·RLS·트리거
2. `002_storage.sql` — Storage 버킷·정책
3. `003_guestbook_private.sql` — 방명록 비공개화
4. `004_credits_publications.sql` — 발행권 원장·publications·네이버 계정·addon_packages
5. `005_retention.sql` — 14일 미발행 자동 삭제 함수
6. `006_ai_usage.sql` — AI 이미지 사용량 추적 (계정당 1회)
7. `007_owner_view_and_engagement.sql` — `publications.owner_token` + 축하/좋아요 카운트 + RPC
8. `008_archive_and_packages.sql` — 영구소장 ledger + AI 스냅/영상/가족 패키지 + `publish_invitation_v4` (만료 = 결혼식 날짜 + 30일)
9. `009_fix_invitation_is_active.sql` — `invitation_is_active()` 가 publications 기반으로 동작하도록 수정 (RLS 거짓 음성 해결)
10. `010_single_publication.sql` — 1 알림장당 1개 활성 publication 보장
11. `011_force_active_publications.sql` — 레거시 invitations 행을 publications 로 강제 동기화
12. `012_snap_credits_and_anchors.sql` — AI 웨딩스냅 크레딧 원장 + `snap_anchors` 테이블
13. `013_snap_solo_anchors_and_jobs.sql` — solo 앵커(groom/bride 분리) + `snap_jobs` 작업 로그
14. `014_snap_anchor_history.sql` — 폐기된 앵커 이력 보존

타입 자동 생성 (선택):

```bash
npx supabase gen types typescript --project-id <REF> --schema public \
  > src/types/database.ts
```

### 4. 외부 서비스 등록

| 서비스 | 무엇 | 가이드 |
| --- | --- | --- |
| Supabase | 프로젝트 + Storage 버킷 | 마이그레이션 실행으로 자동 |
| Naver Developers | OAuth (이메일 권한 권장), Callback `<BASE>/api/auth/naver/callback` | https://developers.naver.com |
| Naver Commerce API | (선택) 스마트스토어 주문 자동 조회 | https://apicenter.commerce.naver.com |
| fal.ai | API 키 + OpenAI Image credits 충전 | https://fal.ai/dashboard/keys + [docs/ai-concept-image-setup.md](docs/ai-concept-image-setup.md) |
| PortOne V2 | 가맹점 가입 + Toss 채널 연동 | https://admin.portone.io |

### 5. 개발 서버

```bash
npm run dev          # http://localhost:3000
npm run build        # 프로덕션 빌드
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
```

## 디렉토리 구조

```
src/
├── app/
│   ├── (marketing)/                # 랜딩 + 마이페이지(저장 내역/발행권/주문/영구소장)
│   ├── (auth)/                     # 네이버 로그인 + 콜백 + AutoLoginGate
│   ├── (editor)/                   # 편집기 / 실시간 미리보기 / 결제
│   ├── [slug]/                     # 하객용 알림장
│   │   └── o/[token]/              # 신랑신부 소장용 (영구소장 시 만료 없음)
│   ├── api/
│   │   ├── ai/concept-{generate,status,finalize}/   # AI 컨셉 이미지 (큐 모드)
│   │   ├── snap/{generate,status,finalize,anchor}/  # AI 웨딩스냅 (큐 모드)
│   │   ├── snap/jobs/poll-pending/                  # 배치 finalize (mypage 진입 시)
│   │   ├── invitations/[id]/{,certificate}/         # CRUD + 혼인서약서 PDF
│   │   ├── publish/[id]/            # publish_invitation_v4
│   │   ├── archive/[id]/            # 영구소장 적용
│   │   ├── auth/naver/{start,callback}/
│   │   ├── orders/{register,...}/
│   │   ├── credits/                 # 발행권 잔액
│   │   ├── packages/                # addon_packages 카탈로그
│   │   ├── me/entitlements/         # 보유 패키지 + 잔량
│   │   ├── cron/cleanup-drafts/     # 14일 미발행 자동 삭제
│   │   └── guest/{visit,signature,quiz,vote,guestbook,cheer,gallery-like}/
│   └── layout.tsx                  # AutoLogout + AutoLoginGate
├── components/
│   ├── ui/
│   ├── invitation/
│   │   ├── slides/                 # 11개 슬라이드 (mode='guest'|'owner')
│   │   ├── SlideContainer (per-slide FallingPetals 으로 변경 — 영상/갤러리 z-20 차단)
│   │   ├── InvitationSlides (mode + ownerData prop 전파)
│   │   └── SignatureGate · VisitTracker
│   ├── editor/
│   │   ├── sections/               # 11개 섹션 에디터
│   │   ├── PresetTextArea          # 추천 문구 콤보박스 (portal + flip-up)
│   │   ├── ImageUploader (frameVariant prop — 폴라로이드/하트/스크린 셰이프 미리보기)
│   │   ├── AIImageGenerator (큐 모드 폴링)
│   │   └── EditorToolbar / SectionEditor
│   ├── shared/
│   │   ├── FallingPetals (꽃잎/별빛 등 8종 + 별도 Starlight 분기)
│   │   ├── HeartClip (objectBoundingBox 스케일 안전 하트 클립)
│   │   ├── SignaturePad
│   │   └── Confetti
│   └── auth/AutoLoginGate · AutoLogout
├── lib/
│   ├── supabase/{client,server,admin,middleware}.ts
│   ├── fal/{client,prompts,concepts}.ts  # fal 모델 wrappers (gpt-image-2, birefnet, flux img2img, aura-sr, topaz)
│   ├── snap/
│   │   ├── catalog.ts              # 10종 카탈로그 정의 + personality
│   │   ├── catalog-metadata.ts     # 카탈로그 마스터 LAB/Kelvin 메타 추출 (캐시)
│   │   ├── prompt.ts               # 4개 prompt 빌더 + 카탈로그 컬러 hint 주입
│   │   ├── harmonize.ts            # Phase 1: 마스크 인지 색매칭
│   │   ├── finishing.ts            # Phase 2: flux img2img 마감 패스
│   │   ├── postprocess.ts          # 4단 파이프라인 (harmonize + finishing + upscale + sharpen)
│   │   ├── finalize.ts             # finalize 공용 헬퍼
│   │   ├── jobs.ts                 # snap_jobs INSERT/UPDATE
│   │   └── anchor-templates.ts     # 앵커 baselineSceneHint
│   ├── presets.ts                  # 노웨딩/스몰웨딩 톤 추천 문구 5종 분야
│   ├── theme.ts                    # 색상·폰트·페탈 카탈로그
│   ├── payment/portone.ts
│   ├── naver/{oauth,smartstore}.ts
│   └── utils/{nanoid,validation}.ts
├── stores/editor.ts                # Zustand persist (unsaved 플래그로 기기간 동기화)
└── types/{database,invitation}.ts  # Supabase 타입 + Zod 스키마

supabase/migrations/
├── 001_initial.sql
├── 002_storage.sql
├── 003_guestbook_private.sql
├── 004_credits_publications.sql
├── 005_retention.sql
├── 006_ai_usage.sql
├── 007_owner_view_and_engagement.sql
├── 008_archive_and_packages.sql
├── 009_fix_invitation_is_active.sql        # RLS 거짓 음성 fix
├── 010_single_publication.sql              # 1 알림장 = 1 publication
├── 011_force_active_publications.sql       # 레거시 → publications 동기화
├── 012_snap_credits_and_anchors.sql        # 스냅 크레딧 + 앵커
├── 013_snap_solo_anchors_and_jobs.sql      # solo 앵커 + snap_jobs
└── 014_snap_anchor_history.sql             # 앵커 폐기 이력

docs/
├── env-variables.md                  # 모든 env 변수 일람 + 운영 권장값
├── wedding-snap-pipeline.md          # 웨딩스냅 4단 파이프라인 + 비용
├── ai-concept-image-setup.md         # AI 컨셉 이미지 셋업
├── kakao-oauth-setup.md              # 카카오 OAuth (선택)
├── local-fonts-guide.md              # 한글 폰트 추가
└── testing-guide.md                  # 테스트 가이드
```

## 배포 (Vercel)

1. Vercel 프로젝트 연결
2. 환경 변수 등록 — 운영 도메인 기준 `NEXT_PUBLIC_BASE_URL`, `CRON_SECRET`
3. Supabase Dashboard → Authentication → URL Configuration 에 운영 도메인의
   `/auth/callback` 추가
4. PortOne 가맹점 측 운영 도메인 허용
5. `vercel.json` 이 매일 04:00 KST 에 `/api/cron/cleanup-drafts` 호출

## 라이선스

비공개.
