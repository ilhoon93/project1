# 미니멈 웨딩 스튜디오

결혼식 알림장과 AI 메인 사진을 9,900원에 제공하는 모바일 우선 청첩장 서비스. Phase 1 MVP.

## 핵심 흐름

```
카카오/네이버 로그인 → 알림장 생성(계정당 최대 10개) → 8개 슬라이드 편집
              → AI 메인 사진 1장 (무료) → 실시간 미리보기
              → 9,900원 결제 (발행권 2개 지급)
              → 마이페이지에서 발행 확인 → 30일 한정 고유 URL → 카카오톡 공유
              → 하객 방문/서명/퀴즈/투표/방명록
              → 마이페이지에서 저장 내역 / 발행권 / 주문 / 삭제 관리
              → 네이버 스마트스토어 주문번호로 발행권 추가 가능

* 미발행 상태로 14일간 수정이 없는 알림장은 자동 삭제 (cron)
* 브라우저 종료 / 30분 유휴 시 자동 로그아웃
```

## 스택

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | Next.js 14 (App Router) · TypeScript · Tailwind CSS v3 · shadcn/ui (classic) |
| 상태 | Zustand (편집기) · TanStack Query (선택) |
| 백엔드 | Supabase Postgres · RLS · Storage |
| 인증 | Supabase Auth (Kakao OAuth) · Naver Login (custom OAuth bridge) |
| AI | fal.ai · `nano-banana/edit` 모델 |
| 결제 | PortOne V2 + Toss Payments 채널 |
| 호스팅 | Vercel |

## 셋업

### 1. 의존성

```bash
npm install
```

### 2. 환경 변수

`.env.local.example`을 복사:

```bash
cp .env.local.example .env.local
```

채워야 할 값:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>

FAL_KEY=<fal.ai API key>

NEXT_PUBLIC_PORTONE_STORE_ID=<store-...>
NEXT_PUBLIC_PORTONE_CHANNEL_KEY=<channel-key-...>
PORTONE_API_SECRET=<server secret>

NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

> Kakao OAuth는 Supabase Dashboard → Authentication → Providers에 직접 등록합니다. `KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`는 `.env`에 있어도 코드는 사용 안 함 (백업 용도). 자세한 절차는 [docs/kakao-oauth-setup.md](docs/kakao-oauth-setup.md).

### 3. 데이터베이스 마이그레이션

두 가지 방법 중 택1.

**A. Supabase Dashboard (CLI 없이)**

1. Supabase Dashboard → **SQL Editor** → **New query**
2. [supabase/migrations/001_initial.sql](supabase/migrations/001_initial.sql) 복붙 후 Run
3. 같은 방식으로 [supabase/migrations/002_storage.sql](supabase/migrations/002_storage.sql) 실행
4. [supabase/migrations/003_guestbook_private.sql](supabase/migrations/003_guestbook_private.sql) 실행
5. [supabase/migrations/004_credits_publications.sql](supabase/migrations/004_credits_publications.sql) 실행 (발행권/네이버 주문 테이블 + 새 publish RPC)
6. [supabase/migrations/005_retention.sql](supabase/migrations/005_retention.sql) 실행 (14일 미발행 자동 삭제 함수)

**B. Supabase CLI**

```bash
npm install -D supabase
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

이후 자동 타입 생성 (선택):

```bash
npx supabase gen types typescript --project-id <PROJECT_REF> --schema public \
  > src/types/database.ts
```

### 4. 개발 서버

```bash
npm run dev
# http://localhost:3000
```

## 외부 서비스 등록

| 서비스 | 무엇을 등록 | 가이드 |
| --- | --- | --- |
| **Supabase** | 프로젝트 + Auth Provider(Kakao) + Storage 버킷 자동 | 위 마이그레이션 |
| **Kakao Developers** | REST API key + Redirect URI = `https://<ref>.supabase.co/auth/v1/callback` | [docs/kakao-oauth-setup.md](docs/kakao-oauth-setup.md) |
| **Naver Developers** | 애플리케이션 등록 + Callback = `<BASE_URL>/api/auth/naver/callback` (이메일 권한 권장) | https://developers.naver.com |
| **Naver Commerce API** | (선택) 스마트스토어 주문 자동 조회용. 별도 애플리케이션 등록 + 셀프 클라이언트 시크릿 발급 | https://apicenter.commerce.naver.com |
| **fal.ai** | API 키 발급 | https://fal.ai/dashboard/keys |
| **PortOne V2** | 가맹점 가입 + Toss 채널 연동 | https://admin.portone.io |

## 스크립트

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run format       # Prettier 포맷팅
npm run format:check # 포맷팅 검사
```

## 디렉토리 구조

```
src/
├── app/
│   ├── (marketing)/         # 랜딩 + 마이페이지 (저장 내역 / 발행권 / 주문)
│   ├── (auth)/              # 카카오 로그인 + 콜백
│   ├── (editor)/            # 편집기 / 실시간 미리보기 / 결제 (인증 가드)
│   │   ├── new/
│   │   ├── edit/[id]/
│   │   ├── preview/[id]/      # LivePreview — Zustand store에서 실시간 hydration
│   │   └── purchase/[id]/
│   ├── [slug]/              # 발행된 공개 알림장 — publications.slug 우선, invitations.slug 폴백
│   ├── api/
│   │   ├── ai/free-preview/    # 무료 AI 이미지 1장
│   │   ├── invitations/        # 알림장 CRUD
│   │   ├── payment/{prepare,verify}/   # PortOne → grant_purchase_credits
│   │   ├── publish/[id]/       # publish_invitation_v2 (크레딧 -1, 새 슬러그)
│   │   ├── auth/naver/{start,callback}/  # 네이버 로그인 OAuth 브릿지
│   │   ├── orders/             # 주문 목록 + register (스마트스토어 주문번호)
│   │   ├── credits/            # 발행권 잔액 + 원장
│   │   ├── packages/           # addon_packages 카탈로그
│   │   ├── cron/cleanup-drafts/ # 14일 미발행 자동 삭제 (CRON_SECRET 헤더)
│   │   └── guest/{visit,signature,quiz,vote,guestbook}/
│   ├── error.tsx · global-error.tsx · not-found.tsx
│   └── layout.tsx · middleware.ts (auth refresh + 라우트 가드)
├── components/
│   ├── ui/                  # shadcn (Button)
│   ├── invitation/
│   │   ├── slides/          # 9개 슬라이드 컴포넌트
│   │   ├── SlideContainer · InvitationSlides
│   │   └── SignatureGate · VisitTracker
│   ├── editor/
│   │   ├── sections/        # 9개 섹션 에디터
│   │   └── EditorToolbar · SectionEditor · AIImageGenerator
│   └── shared/              # FallingPetals · SignaturePad
├── lib/
│   ├── supabase/{client,server,admin,middleware}.ts
│   ├── fal/{client,prompts}.ts
│   ├── payment/portone.ts
│   ├── naver/{oauth,smartstore}.ts        # 네이버 로그인 + 커머스 API 클라이언트
│   └── utils/{nanoid,validation}.ts
├── stores/editor.ts          # Zustand
└── types/{database,invitation}.ts  # Supabase + Zod

supabase/
└── migrations/
    ├── 001_initial.sql                # tables + RLS + RPC + triggers
    ├── 002_storage.sql                # buckets + storage RLS
    ├── 003_guestbook_private.sql      # guestbook 비공개화
    ├── 004_credits_publications.sql   # 발행권 원장, publications, naver_accounts, addon_packages, publish_invitation_v2
    └── 005_retention.sql              # cleanup_stale_drafts (14일 미발행 자동 삭제)

docs/
└── kakao-oauth-setup.md
```

## 배포 (Vercel)

1. Vercel 프로젝트 연결 (이 리포 가져오기)
2. 환경 변수 동일하게 등록 — 특히 `CRON_SECRET`을 임의의 긴 문자열로 발급 (cron 인증)
3. `NEXT_PUBLIC_BASE_URL`을 운영 도메인으로 변경
4. Supabase Dashboard → Authentication → URL Configuration에 운영 도메인의 `/auth/callback` redirect URL 추가
5. PortOne 가맹점 측에서 운영 도메인을 허용 도메인에 추가
6. [vercel.json](vercel.json)이 매일 04:00 KST에 `/api/cron/cleanup-drafts`를 호출 — 별도 설정 불필요. 비-Vercel 환경에서는 외부 스케줄러로 같은 헤더(`Authorization: Bearer $CRON_SECRET`)를 붙여 호출하면 된다.

## Phase 1에 포함되지 않음

다음은 Phase 2 이후 작업.

- AI 화보 15장 (LoRA 학습)
- 가족 포토카드, 모션 앨범, 릴스 영상
- 1+1 혼주용 템플릿
- 관리자 검수 대시보드
- 데이터 통계 PDF 자동 발송
- 만료 데이터 자동 정리 잡
- 방문 시간(`duration_seconds`)·슬라이드 시청(`slides_viewed`) 정밀 추적
- PortOne 모바일 redirect 흐름 (현재는 inline 모달)
- 이메일/카카오 알림톡 트리거

## 라이선스

비공개 — 미니멈 웨딩 스튜디오.
