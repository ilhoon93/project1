# 환경 변수 · 설정값 참조

이 문서는 `우리다운` 프로젝트의 모든 환경 변수, 기본값, 운영 권장값을 한곳에
정리한다. 실제 값은 `.env.local` (로컬) 과 Vercel 환경변수 (운영) 양쪽에 등록.
샘플은 [`.env.local.example`](../.env.local.example).

> **보안 원칙**
> - 시크릿(SUPABASE_SERVICE_ROLE_KEY, FAL_KEY, PORTONE_API_SECRET, NAVER_*_SECRET, CRON_SECRET)
>   은 절대 클라이언트 번들에 들어가지 않게. 이름이 `NEXT_PUBLIC_` 으로 시작하지
>   않으면 자동으로 서버 전용.
> - 과거에 노출된 적이 있으면 발급처에서 즉시 rotate.

## 한눈에 보기

| 변수 | 필수 | 기본값 | 비고 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | — | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | — | RLS 기반 클라이언트 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | 서버 전용. RLS 우회 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | ✅ | — | 네이버 로그인 OAuth |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | ⬜ | — | 카카오 OAuth (선택) |
| `NAVER_COMMERCE_CLIENT_ID` / `_SECRET` | ⬜ | — | 스마트스토어 주문 자동 조회 |
| `FAL_KEY` | ✅ | — | AI 이미지 생성 |
| `SNAP_HARMONIZE_MODE` | ⬜ | `masked` | 웨딩스냅 색매칭 |
| `SNAP_FINISHING_MODE` | ⬜ | `img2img` | 웨딩스냅 img2img 마감 패스 |
| `SNAP_UPSCALE_MODE` | ⬜ | `off` | 웨딩스냅 업스케일 |
| `NEXT_PUBLIC_PORTONE_STORE_ID` | ✅ | — | PortOne V2 가맹점 |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | ✅ | — | Toss 채널 키 |
| `PORTONE_API_SECRET` | ✅ | — | 서버 전용 |
| `NEXT_PUBLIC_BASE_URL` | ✅ | `http://localhost:3000` | 운영 도메인 |
| `CRON_SECRET` | ✅ (prod) | — | cron 인증 |

✅ = 필수, ⬜ = 선택. 선택 변수가 비어 있으면 관련 기능이 자동으로 비활성/폴백.

---

## Supabase

### `NEXT_PUBLIC_SUPABASE_URL`
- **설명**: Supabase 프로젝트의 base URL. 형식 `https://<ref>.supabase.co`
- **위치**: Supabase Dashboard → Project Settings → API → Project URL
- **클라이언트/서버**: 둘 다 (브라우저에 노출됨, 안전)

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **설명**: 익명 사용자가 사용하는 공개 키. RLS 정책이 모든 접근을 검증.
- **위치**: 같은 대시보드 → API → `anon` `public`
- **클라이언트/서버**: 둘 다

### `SUPABASE_SERVICE_ROLE_KEY`
- **설명**: RLS 우회 가능한 master 키. **서버 전용**. 게스트 입력(방명록/서명/투표 등) insert 와 owner 페이지 통계 fetch 에 사용.
- **위치**: 같은 대시보드 → API → `service_role`
- **클라이언트/서버**: **서버만**. 노출 시 즉시 rotate.
- **사용 코드**: `src/lib/supabase/admin.ts` 의 `createAdminClient()`

## 인증

### 네이버 (`NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`)
- **설명**: [Naver Developers](https://developers.naver.com) 에서 발급. 자체 OAuth 브릿지로 Supabase 세션 발급.
- **콜백 URL**: `<NEXT_PUBLIC_BASE_URL>/api/auth/naver/callback`
- **필수 권한**: 회원이름·이메일·별명. 이메일 권한 없으면 가짜 이메일로 가입됨.
- **사용 코드**: `src/app/api/auth/naver/*`

### 카카오 (`KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET`) — 선택
- **설명**: 카카오 OAuth. Supabase Dashboard → Authentication → Providers → Kakao 에 등록되어 있으면 동작.
- **코드 사용**: 직접 참조하지 않음. 일부 운영 스크립트만.

### 네이버 커머스 (`NAVER_COMMERCE_CLIENT_ID` / `_SECRET`) — 선택
- **설명**: [네이버 커머스 API](https://apicenter.commerce.naver.com) 자격증명. 미설정 시 `/api/orders/register` 가 사용자 입력 상품주문번호를 검증 없이 그대로 적립 (테스트용 폴백).
- **운영 권장**: 설정. 위변조 방지.

## AI (fal.ai)

### `FAL_KEY`
- **설명**: fal.ai API 키. AI 컨셉 이미지 + AI 웨딩스냅 양쪽이 공유.
- **위치**: [fal.ai 대시보드 → Keys](https://fal.ai/dashboard/keys)
- **충전**: 사용량 기준 과금. OpenAI Image credits 별도 충전 필요 (gpt-image-2 는 fal.ai 의 OpenAI 파트너 모델).
- **사용 모델**: `openai/gpt-image-2/edit`, `fal-ai/birefnet`, `fal-ai/flux/dev/image-to-image`, `fal-ai/aura-sr`, `fal-ai/topaz/upscale/image`
- **사용 코드**: `src/lib/fal/client.ts`

## 웨딩스냅 후처리 파이프라인 (env flag)

각 단계가 독립 ON/OFF 가능. 자세한 작동 원리·비용은 [`wedding-snap-pipeline.md`](./wedding-snap-pipeline.md) 참조.

### `SNAP_HARMONIZE_MODE` — Phase 1 색매칭
| 값 | 동작 | 추가 비용 | 추가 시간 |
|---|---|---|---|
| `off` | 비활성 | $0 | 0s |
| `global` | 마스크 없이 전역 LAB 매칭 (sharp 로컬) | $0 | ~0s |
| `masked` **(기본)** | birefnet 마스크 + 분할 매칭 (배경 강하게, 사람 약하게 → 피부톤 보호) | ~$0.003 | ~3–5s |

### `SNAP_FINISHING_MODE` — Phase 2 img2img 마감
| 값 | 동작 | 추가 비용 | 추가 시간 |
|---|---|---|---|
| `off` | 비활성 | $0 | 0s |
| `img2img` **(기본)** | flux/dev img2img strength 0.2 — identity drift 없이 톤/조명/그레인 통합 | ~$0.025 | ~5–8s |

### `SNAP_UPSCALE_MODE` — 업스케일 + sharpen
| 값 | 동작 | 추가 비용 | 추가 시간 |
|---|---|---|---|
| `off` **(기본)** | 비활성 | $0 | 0s |
| `aura-sharpen` | aura-sr 2x → unsharp mask. 얼굴 보존 ★★★★★ | ~$0.015 | ~5s |
| `topaz-sharpen` | Topaz Standard V2 2x → unsharp mask. 디테일 복원 ★★★★★ | ~$0.06 | ~8s |

### 운영 권장 조합
- **품질 최우선** (default): `harmonize=masked`, `finishing=img2img`, `upscale=topaz-sharpen` — 1장당 ~$0.16
- **비용 절감**: `harmonize=global`, `finishing=off`, `upscale=off` — 1장당 ~$0.07 (= 베이스라인)
- **긴급 비활성** (이슈 대응): 모두 `off` — 생성 결과 raw 그대로 노출

## 결제 (PortOne V2)

### `NEXT_PUBLIC_PORTONE_STORE_ID`
- **설명**: PortOne 가맹점 ID. 브라우저에 노출됨.
- **위치**: [PortOne 관리자](https://admin.portone.io) → 연동 정보

### `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`
- **설명**: Toss Payments 채널 키. 브라우저에 노출됨.

### `PORTONE_API_SECRET`
- **설명**: 서버 결제 검증용 시크릿. **서버 전용**.
- **사용 코드**: `src/lib/payment/portone.ts`

## 도메인

### `NEXT_PUBLIC_BASE_URL`
- **설명**: 사이트의 origin URL. OAuth 콜백, PortOne 결제 webhook, AI 호출 시 카탈로그 절대 URL 생성 등에 사용.
- **로컬**: `http://localhost:3000`
- **운영**: `https://<your-domain>` (https 필수)

## Cron

### `CRON_SECRET`
- **설명**: `/api/cron/cleanup-drafts` 호출 시 `Authorization: Bearer <CRON_SECRET>` 헤더 검증. Vercel Cron 이 자동으로 동일 헤더를 붙이므로 등록만 하면 동작.
- **운영 필수**: 미설정 시 cron 라우트가 500 반환.
- **로컬 테스트**: `curl -H "Authorization: Bearer <value>" http://localhost:3000/api/cron/cleanup-drafts`

---

## 변경 / 추가 시 체크리스트

새 env 변수 추가 시:
1. `.env.local.example` 에 placeholder + 주석 추가 (이 파일도 함께)
2. 운영 Vercel 대시보드에 동일 키 등록
3. 코드에서는 [`src/lib/env.ts`](../src/lib/env.ts) 의 `requireEnv()` 로 lazy 읽기 — 빌드 시점에 환경변수 검사하지 않게
4. 본 문서에 행 추가 + 기본값/필수 여부 표시

## 관련 문서

- [README](../README.md)
- [웨딩스냅 파이프라인 · 비용](./wedding-snap-pipeline.md)
- [AI 컨셉 이미지 셋업](./ai-concept-image-setup.md)
- [카카오 OAuth 셋업](./kakao-oauth-setup.md)
- [로컬 폰트 가이드](./local-fonts-guide.md)
