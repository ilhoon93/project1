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
| `SNAP_UPSCALE_MODE` | ⬜ | `topaz-sharpen` | 웨딩스냅 업스케일 (최고 품질 default) |
| `SNAP_IDENTITY_MODE` | ⬜ | `face-swap` | 카탈로그 결과의 얼굴 identity 복원 (face-swap) |
| `SNAP_IMAGE_QUALITY` | ⬜ | `medium` | 카탈로그 gpt-image-2 quality (`low`/`medium`/`high`/`auto`) |
| `SNAP_CATALOG_FACE_BLUR` | ⬜ | `on` | 카탈로그 마스터 얼굴 영역 사전 blur |
| `FAL_WEBHOOK_SECRET` | ⬜ | — | fal 콜백 인증 토큰 (미설정 시 polling 만 사용) |
| `FAL_WEBHOOK_BASE_URL` | ⬜ | (요청 origin) | fal webhook 의 호스트 override |
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
- **동의 항목 (Naver Developers 콘솔에서 설정)**: **필수 = 이메일 주소 하나만**. 회원이름·별명은 "선택" 으로 둔다.
  - 식별 키는 이메일이 아니라 Naver 고유 `id` (응답 필수값) 라서, 이름/별명/이메일 동의 여부와 무관하게 고객 식별·주문 매칭은 정상 동작한다.
  - 이메일은 필수라 항상 내려오지만, 만약 비어 있어도 코드가 가짜 이메일(`naver_<id>@users.minimum-wedding.local`)로 가입을 이어간다 (방어용 폴백).
  - 이름/별명이 비면 `display_name` 은 이메일 앞부분으로 자동 폴백된다.
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
| `off` | 비활성 | $0 | 0s |
| `aura-sharpen` | aura-sr 2x → unsharp mask. 얼굴 보존 ★★★★★, 디테일 약함 | ~$0.005 | ~5s |
| `topaz-sharpen` **(기본)** | Topaz Standard V2 2x → unsharp mask. 디테일 복원 ★★★★★. face-swap 후 실행되어 identity 안전 | ~$0.015 | ~8s |

### `SNAP_IDENTITY_MODE` — 카탈로그 얼굴 identity 복원 (Phase B)
| 값 | 동작 | 추가 비용 | 추가 시간 |
|---|---|---|---|
| `off` | 비활성 (Phase A multi-image 결과 그대로) | $0 | 0s |
| `face-swap` **(기본)** | catalog 결과 + selfie / 커플 사진 → fal-ai/face-swap. 카탈로그 구도/의상 유지하고 얼굴만 사용자 진본으로 교체. solo/together/couple 모두 작동 | ~$0.01~0.04 | ~3~10s |

### `SNAP_IMAGE_QUALITY` — 카탈로그 gpt-image-2 quality
| 값 | 동작 | 추가 비용 | 추가 시간 |
|---|---|---|---|
| `low` | gpt-image-2 quality=low. ~272 토큰, 거친 결과 | ≈ -$0.03/장 (대비 medium) | ↓ 조금 빠름 |
| `medium` **(기본)** | gpt-image-2 quality=medium. ~1,056 토큰, 인페인팅에서 충분 | 기준 | 기준 |
| `high` | gpt-image-2 quality=high. ~4,160 토큰, 디테일 최대. A/B 테스트용 | ≈ +$0.09/장 (대비 medium) | ↑ 다소 느림 |
| `auto` | fal 측 자동 결정 (모델 정책에 위임) | 변동 | 변동 |

`/api/snap/generate` 의 fal 호출에만 적용 (앵커 생성은 항상 `high`, 컨셉 생성은
별도). 잘못된 값은 `medium` fallback + 첫 호출 시 한 번 경고 로깅.
실제 사용된 값은 `snap_jobs.quality` 에 그대로 기록되어 비용 분석/실험에 사용.

### `SNAP_CATALOG_FACE_BLUR` — 카탈로그 마스터 얼굴 영역 사전 blur (Phase C)
| 값 | 동작 | 추가 비용 | 추가 시간 |
|---|---|---|---|
| `off` | 비활성 (원본 그대로 fal 에 전달) | $0 | 0s |
| `on` **(기본)** | sharp 로 카탈로그 마스터 얼굴 영역만 강한 blur 처리. 모델이 catalog 의 다른 얼굴 특징에 attention 끌려가지 X | $0 (sharp 로컬 + 메모리 캐시) | ~0s |

### `FAL_WEBHOOK_SECRET` — fal 비동기 finalize 콜백 인증
fal.queue.submit 시 webhookUrl 동봉 → fal 작업 완료 시 즉시 finalize 트리거.
미설정 시 webhookUrl 미동봉 → polling (poll-pending) 만으로 동작.

값: 32자 이상 랜덤 문자열. 생성 예: `openssl rand -hex 32`
관련: `FAL_WEBHOOK_BASE_URL` 로 webhook 호스트 명시 가능 (Vercel preview 처럼 변동 URL 환경 권장).

### 운영 권장 조합
- **품질 최우선** (현재 default): `harmonize=masked`, `finishing=img2img`, `identity=face-swap`, `catalog-face-blur=on`, `upscale=topaz-sharpen` — 1장당 ~$0.13
- **비용 절감**: 위 default 에서 `SNAP_UPSCALE_MODE=aura-sharpen` (-$0.01) 또는 `off` (-$0.015)
- **운영 가시성**: `FAL_WEBHOOK_SECRET` 설정해 finalize 즉시성 확보 + Vercel 함수 호출 ↓
- **비용 절감**: `harmonize=global`, `finishing=off`, `identity=off`, `catalog-face-blur=on`, `upscale=off` — 1장당 ~$0.07 (= 베이스라인)
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
