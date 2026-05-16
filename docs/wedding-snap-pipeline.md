# AI 웨딩스냅 — 파이프라인 · 비용 · 운영 가이드

신랑·신부 셀카(또는 커플 사진) → 카탈로그 컷 컨셉으로 합성된 웨딩스냅 이미지를
생성하는 전체 흐름. 톤 일관성을 위한 4단 후처리, env flag 기반 토글, 단계별
비용·시간 비교가 한 곳에 정리되어 있다.

## 1. 시스템 개요

### 입력
- **앵커 모드 (`mode='anchor'`)**: 사전 저장된 신랑/신부 앵커 (각 1장씩) + 카탈로그 마스터
- **커플 모드 (`mode='couple'`)**: 커플 사진 원본 + 카탈로그 마스터 (앵커 우회)

### 출력
- 카탈로그 컷의 포즈·배경·의상·조명을 유지하면서 사용자 얼굴/체형만 교체된 1024×1536 JPG
- Supabase `public-images/wedding-snap/{userId}/...jpg` 에 영구 호스팅

### 카탈로그
- 정적 자산: `public/wedding-snap/catalog/{id}.jpg` (10종)
- 카테고리: studio · outdoor · tradition · urban · beach
- Personality: `together` / `groom-solo` / `bride-solo`
- 정의: [`src/lib/snap/catalog.ts`](../src/lib/snap/catalog.ts)

## 2. 전체 데이터 흐름

```
┌─────────────────────────────┐
│  사용자가 카탈로그 N개 선택   │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  POST /api/snap/generate                                 │
│   - 카탈로그 메타 사전 추출 (catalog-metadata.ts)        │
│   - 모드별 프롬프트 빌드 (prompt.ts) + color hint 주입   │
│   - snap 크레딧 1 차감 (RPC consume_snap_credit)         │
│   - fal.queue.submit("openai/gpt-image-2/edit")          │
│   - snap_jobs INSERT (status='submitted')                │
│   → 응답: { requestId, catalogId, ... }                  │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼ (클라이언트가 폴링 또는 mypage 진입 시 일괄)
┌─────────────────────────────────────────────────────────┐
│  POST /api/snap/finalize  또는                            │
│  POST /api/snap/jobs/poll-pending                        │
│   - fal.queue.result 로 결과 URL 획득                    │
│   - applyUpscalePostprocess (4단 파이프라인) → Buffer    │
│   - public-images 영구 호스팅                            │
│   - snap_jobs UPDATE (status='completed', result_url)    │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
        사용자 마이페이지에 결과 노출
```

### 후처리 파이프라인 (카탈로그 결과 한정)

각 단계가 env flag 로 독립 ON/OFF, 실패 시 직전 결과로 graceful fallback.

```
fal 결과 URL (gpt-image-2 multi-image edit, Phase A)
   │
   ▼
[Phase B] face-swap 복원        [SNAP_IDENTITY_MODE=face-swap, default]
   - fal-ai/face-swap 으로 catalog 결과 얼굴을 selfie 진본으로 교체
   - solo: 1회 swap / together: 2회 (groom face_index=0, bride face_index=1)
   - 카탈로그 구도/의상/배경은 100% 그대로
   - 비용 ~$0.01~0.04/장
   ▼ (postprocess 모듈 src/lib/snap/postprocess.ts 진입)
1. Harmonize                    [SNAP_HARMONIZE_MODE]
   - 카탈로그 LAB 평균과의 채널별 게인 적용 (sharp .linear)
   - L 채널 보존(노출 안 망가짐), A/B chroma 만 시프트
   - masked 모드: birefnet 으로 foreground 마스크 → 배경 강하게, 사람 약하게
   ▼
2. Finishing                    [SNAP_FINISHING_MODE]
   - fal-ai/flux/dev/image-to-image, strength=0.2, guidance=3.5
   - 카탈로그 mood ("warm golden-hour ~3500K") 프롬프트로 주입
   - identity / pose / composition 거의 그대로, 톤·조명·grain 만 통합
   ▼
3. Upscale                      [SNAP_UPSCALE_MODE]
   - aura-sr: Real-ESRGAN 계열, 얼굴 보존 우수, detail 약함
   - topaz/upscale: 사진 전용 모델, detail 복원 우수
   - 둘 다 2x, face_enhancement=false (identity 보호)
   ▼
4. Sharpen + JPEG encode        (upscale 이 활성일 때만)
   - sharp unsharp mask (sigma 1.0, m1 0.5, m2 0.5)
   - JPEG quality 92 (mozjpeg)
   ▼
storage 업로드
```

### Phase C — 카탈로그 마스터 사전 가공      [SNAP_CATALOG_FACE_BLUR]

`on` 일 때 fal 호출 전에 catalog 마스터에 사전 처리:
- `catalog.ts` 의 `faceMaskRegions` (0~1 정규화 좌표) 영역만 sharp 로 강한 Gaussian blur (sigma 35)
- 모델이 catalog 의 다른 얼굴에 attention 끌려가는 것 방지
- in-memory 캐시로 같은 catalog 재사용 시 추가 비용 0

#### 단계 간 URL/Buffer 변환

- fal 모델(birefnet, flux, aura, topaz) 은 image_url 만 받음
- sharp 는 Buffer 만 받음
- `PipelineState` 가 currentUrl / currentBuf 중 어느 쪽이 최신인지 추적, `ensureBuf` / `ensureUrl` 가 lazy 변환
- Buffer → URL 변환은 `public-images/wedding-snap/ephemeral/` 임시 업로드로 처리 (별도 cleanup cron 필요)

## 3. 프롬프트 설계

`src/lib/snap/prompt.ts` 의 4개 빌더:

| 빌더 | 입력 | 사용처 |
|---|---|---|
| `buildAnchorPromptSolo` | 셀카 1~3장 | 앵커 생성 |
| `buildTogetherCatalogPrompt` | groom 앵커 + bride 앵커 + 카탈로그 | personality='together' |
| `buildSoloCatalogPrompt` | one 앵커 + 카탈로그 | personality='groom-solo'/'bride-solo' |
| `buildCouplePhotoSnapPrompt` | 커플 사진 + 카탈로그 | mode='couple' |

### 공통 주입 섹션
- `NEGATIVES` — 플라스틱 피부, beauty filter, paste-in, identity drift 등 17 가지 금지
- `PHOTOREALISM` — RAW DSLR 사실주의 양성 cue (포어, 그레인, 자연 헤어라인)
- `ANCHOR_INTEGRATION` (앵커 한정) — 머리 비율 1/8, paste-in 차단
- `CATALOG_INTEGRATION` (카탈로그 한정) — 스케일은 카탈로그가 권위, 식별성 ≠ 크기
- **`catalogColorHint`** (동적) — 카탈로그 마스터에서 sharp 로 추출한 색온도/mood. 예: `"warm golden-hour (~3500K)"`

### 카탈로그 메타 사전 추출
- `src/lib/snap/catalog-metadata.ts` 의 `getCatalogColorMeta(catalogId)`
- sharp `.stats()` 로 RGB 평균 → LAB 변환 (D65) → R/B 비율로 Kelvin 추정 → 자연어 mood 라벨
- 프로세스 메모리에 캐시. 같은 카탈로그 재호출 시 추가 비용 0

## 4. 모델별 사용 표

| 모델 | 용도 | 호출 위치 | 비용/장 | 시간 |
|---|---|---|---|---|
| `openai/gpt-image-2/edit` (medium) | 메인 생성 | `submitMultiImageEdit` | ~$0.04 | 15–25s |
| `fal-ai/birefnet` | foreground 마스크 | `submitBirefnetMask` | ~$0.003 | 3–5s |
| `fal-ai/flux/dev/image-to-image` | Phase 2 마감 | `submitFluxImg2Img` | ~$0.025 | 5–8s |
| `fal-ai/aura-sr` | 업스케일 (얼굴 보존) | `submitAuraSrUpscale` | ~$0.015 | 3–5s |
| `fal-ai/topaz/upscale/image` (Standard V2) | 업스케일 (디테일) | `submitTopazUpscale` | ~$0.06 | 6–8s |

모든 모델은 `fal.queue.submit / result` 패턴 — 한 번의 함수 호출이 1–5초로 짧음.
Vercel Hobby 60s 함수 제한과 충돌 없음.

## 5. 비용 시나리오

### 베이스라인 (모든 토글 off)
- 생성만 + raw 결과 → ~**$0.04 / 장**

### Default (production 권장 — 현재 default 값)
- `harmonize=masked`, `finishing=img2img`, `identity=face-swap`, `catalog-face-blur=on`, `upscale=off`
- 생성 $0.04 + birefnet $0.003 + flux img2img $0.025 + face-swap $0.02 = **~$0.09 / 장**
- 시간: ~30–45s

### 품질 최우선
- 위 + `upscale=topaz-sharpen`
- ~$0.09 + $0.06 = **~$0.15 / 장**
- 시간: ~35–45s

### 비용 절감 (긴급 대응)
- 모두 `off`
- **~$0.04 / 장**

### 한 사용자 시나리오 — 10장 생성
| 조합 | 1장당 | 총 비용 | 사용자 청구 (크레딧 ₩X) |
|---|---|---|---|
| 모두 OFF | $0.04 | $0.40 | 마진 큼 |
| Default (P1+P2) | $0.07 | $0.70 | 마진 적당 |
| Default + 업스케일 | $0.13 | $1.30 | 마진 빠듯 |

> 실제 가격은 fal 대시보드의 "Usage" 에서 모델별 최근 30일 단가로 확인 필수.
> 가격 변동 가능.

## 6. 토글 운영 시나리오

### 신규 카탈로그 추가 시
1. `public/wedding-snap/catalog/{id}.jpg` 업로드 (1024×1536 권장)
2. `src/lib/snap/catalog.ts` 의 `SNAP_CATALOG` 배열에 항목 추가 (`id`, `label`, `personality`, `promptHint`)
3. 첫 생성 호출 시 메타 자동 추출 → 캐시. 추가 작업 없음

### Phase 1+2 일시 비활성
```env
SNAP_HARMONIZE_MODE=off
SNAP_FINISHING_MODE=off
```
재배포 즉시 적용. 진행 중 작업도 다음 finalize 부터 영향.

### A/B 테스트 (예: finishing strength 비교)
1. `src/lib/snap/finishing.ts` 의 `strength` 값을 코드 상수로 분리
2. 0.18 / 0.20 / 0.22 세 가지 변형 비교 → user feedback 으로 선택
3. 변경 후 PR

### 단계별 디버깅
어느 단계가 실패하는지 확인 — `console.warn('[postprocess] ... failed')` 로그 검색:
- `[harmonize] birefnet failed, falling back to global` → birefnet 호출 실패
- `[postprocess] finishing failed, continuing` → flux img2img 실패
- `[postprocess] aura-sr failed, continuing without upscale` → 업스케일 실패
어느 경우든 finalize 자체는 깨지지 않고 직전 결과로 진행.

## 7. 알려진 이슈 / Follow-up

### 임시 storage 누적
- harmonize → finishing 전달용으로 `public-images/wedding-snap/ephemeral/` 에 buffer 를 임시 업로드
- 별도 정리 cron 미구현 → 누적됨
- **권장**: 24h TTL cleanup cron 추가 (`/api/cron/cleanup-snap-ephemeral`)

### 카탈로그 색온도 추정 정확도
- R/B 비율 휴리스틱 기반 — 카탈로그 마스터가 다양한 라이팅을 가지면 부정확
- **개선안**: 색온도 값을 카탈로그 정의 시 manual override 가능하게 (`SnapCatalogItem.kelvin?: number`)

### 처리 시간 누적
- 4단 모두 ON 시 ~35–45s. Vercel Hobby 60s 한계와 가까움
- 현재 `/api/snap/finalize` maxDuration=60. 향후 추가 단계 도입 시 모니터링 필요

### 비용 가시성
- 사용자 입장에선 1 크레딧 = 1장 (백엔드 비용과 분리). 백엔드 비용 변동이 가격 정책에 즉시 반영되지 않음
- **개선안**: 비용 단계가 큰 모드(예: `topaz-sharpen` 활성)를 "프리미엄" 옵션으로 노출하고 추가 크레딧 차감

## 8. 관련 파일

| 역할 | 파일 |
|---|---|
| 카탈로그 정의 | [`src/lib/snap/catalog.ts`](../src/lib/snap/catalog.ts) |
| 카탈로그 메타 추출 | [`src/lib/snap/catalog-metadata.ts`](../src/lib/snap/catalog-metadata.ts) |
| 프롬프트 빌더 | [`src/lib/snap/prompt.ts`](../src/lib/snap/prompt.ts) |
| 앵커 템플릿 | [`src/lib/snap/anchor-templates.ts`](../src/lib/snap/anchor-templates.ts) |
| Harmonize (Phase 1) | [`src/lib/snap/harmonize.ts`](../src/lib/snap/harmonize.ts) |
| Finishing (Phase 2) | [`src/lib/snap/finishing.ts`](../src/lib/snap/finishing.ts) |
| Upscale + sharpen | [`src/lib/snap/postprocess.ts`](../src/lib/snap/postprocess.ts) |
| Finalize 로직 | [`src/lib/snap/finalize.ts`](../src/lib/snap/finalize.ts) |
| Job 기록 | [`src/lib/snap/jobs.ts`](../src/lib/snap/jobs.ts) |
| fal 모델 wrapper | [`src/lib/fal/client.ts`](../src/lib/fal/client.ts) |
| 생성 API | [`src/app/api/snap/generate/route.ts`](../src/app/api/snap/generate/route.ts) |
| 앵커 API | [`src/app/api/snap/anchor/route.ts`](../src/app/api/snap/anchor/route.ts) |
| Finalize API | [`src/app/api/snap/finalize/route.ts`](../src/app/api/snap/finalize/route.ts) |
| 배치 폴 API | [`src/app/api/snap/jobs/poll-pending/route.ts`](../src/app/api/snap/jobs/poll-pending/route.ts) |
| 환경 변수 참조 | [`docs/env-variables.md`](./env-variables.md) |
| DB 마이그레이션 | `supabase/migrations/012_snap_credits_and_anchors.sql`, `013_snap_solo_anchors_and_jobs.sql`, `014_snap_anchor_history.sql` |

## 9. DB 스키마

### `snap_anchors`
저장된 앵커 1행 / 사용자. groom·bride 각각의 anchor URL + 신체 정보.
- `user_id` (PK)
- `groom_anchor_url`, `bride_anchor_url`
- `groom_height_cm`, `groom_weight_kg`, `bride_height_cm`, `bride_weight_kg`
- `source_mode` ('selfies')
- `last_batch_at` — 무료 활성화 quota 판정용

### `snap_anchor_history`
앵커 폐기 시 보존되는 이력 (사용자가 이전 앵커로 복원 가능하도록).

### `snap_jobs`
생성/앵커 작업 단위 로그.
- `id`, `user_id`, `kind` (`catalog`|`anchor`)
- `fal_request_id`, `model`, `quality`
- `catalog_id`, `catalog_path` (`anchored`|`couple`)
- `status` (`submitted`|`in_progress`|`completed`|`failed`)
- `result_url`, `error_message`, `completed_at`
- `credit_delta` — 차감/환불 회계

### `snap_credits_ledger`
스냅 크레딧 ±. RPC `consume_snap_credit` / `refund_snap_credit` 가 원자적 변경.

자세한 RLS·트리거는 마이그레이션 SQL 파일 참조.
