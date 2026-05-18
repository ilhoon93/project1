# Wedding Snap 안정화 (2026-05 PR 묶음)

이번 라운드 작업의 **9개 PR** 요약과 운영 배포 체크리스트.

## PR 목록 (머지 순서)

1. **PR #114 — Phase logging + face detection validation** (P0)
   `snap_jobs.fal_cost_usd / phase_timings / pipeline_stages / input_*` 컬럼
   각 finalize 단계 비용·타이밍 기록. validation 단계에 face detection 추가.
   마이그: `018_snap_observability.sql`

2. **PR #115 — 자동 환불 DB 트리거** (P0)
   `snap_jobs.status` 가 `failed` / `timeout` 으로 전이되면 트리거가 자동으로
   `refund_snap_credit` 호출. 응용 코드 환불 누락 안전망.
   마이그: `019_snap_auto_refund_trigger.sql`

3. **PR #116 — Private 버킷 + RLS + signed URL** (P0)
   사용자 얼굴 사진을 `private-uploads` 버킷으로 격리. 셀카·커플 사진·앵커
   결과·preprocessed 모두 RLS 차단 + signed URL 노출.
   마이그: `020_snap_private_storage.sql` (버킷 생성만)
   **정책 4개는 별도 적용 필요** — `docs/storage-policies-pr116.md` 참조.
   기존 파일 이동: `scripts/migrate-snap-to-private.mjs`

4. **PR #117 — fal webhook async finalize** (P0)
   fal.queue.submit 시 `webhookUrl` 동봉 → fal 완료 시 즉시 finalize.
   Vercel 60s 함수 제한 회피 + 사용자 latency ↓.
   env: `FAL_WEBHOOK_SECRET`, `FAL_WEBHOOK_BASE_URL`

5. **PR #118 — 동의 UI + 약관 / 처리방침 템플릿** (P0)
   `snap_consent` 테이블 + `SnapGenerator` 동의 모달 + `/legal/snap-terms`,
   `/legal/snap-privacy` 페이지. 한국 PIPA 대응.
   마이그: `021_snap_consent.sql`
   ⚠️ 표준 템플릿 v1 — 실제 출시 전 변호사 검토 권장.

6. **PR #119 — Face similarity 인프라 + 카탈로그 메타 manual override** (P2)
   `snap_jobs.face_similarity_*` 컬럼 + `compareFaces` fal 래퍼 +
   `SnapCatalogItem.manualKelvin` / `manualMoodHint` 옵션.
   마이그: `022_snap_face_similarity.sql`

7. **PR #120 — 커플 모드 face restore + similarity 측정** (P2)
   `applyCoupleFaceSwapRestore` 추가 + finalize 단계 비차단 similarity 측정.
   이번 라운드의 핵심 quality fix — 커플 모드 identity 안전망.
   마이그: `023_snap_couple_photo_ref.sql`

8. **PR #121 — 카탈로그 호환성 점수 + UI 경고 배지** (P2)
   `SnapCatalogItem.intensity` 필드 + `scoreCompatibility` 모듈 +
   카탈로그 그리드 좌하단 호환성 배지.
   "야경 + 강한 골든아워" 같은 위험 조합 사전 경고.

9. **PR #122 — 후처리 기본값 최고 품질** (마무리)
   `SNAP_UPSCALE_MODE` default 를 `off` → `topaz-sharpen` 으로.
   다른 후처리 모드는 이미 최고 품질이 기본이라 정렬.

## 운영 배포 체크리스트

### 1. SQL 마이그레이션 적용 (순서대로)
```
018_snap_observability.sql        ← PR 114
019_snap_auto_refund_trigger.sql  ← PR 115
020_snap_private_storage.sql      ← PR 116 (버킷만)
021_snap_consent.sql              ← PR 118
022_snap_face_similarity.sql      ← PR 119
023_snap_couple_photo_ref.sql     ← PR 120
```

### 2. 020 보강 — Storage Policies 수동 적용
`storage.objects` 정책 4개를 Supabase Studio Storage Policies UI 에서 클릭으로
추가. 자세한 가이드: `docs/storage-policies-pr116.md`

### 3. 환경 변수 설정 (Vercel Dashboard)

**필수**:
- `FAL_WEBHOOK_SECRET` — 32자 이상 랜덤 문자열 (`openssl rand -hex 32`)
- `FAL_WEBHOOK_BASE_URL` — 운영 도메인 (예: `https://yourdomain.com`)

**선택 (default 그대로 가능)**:
- `SNAP_UPSCALE_MODE=topaz-sharpen` (이미 default — 명시 안 해도 OK)
- `FAL_FACE_SIMILARITY_MODEL` — 다른 fal 엔드포인트 사용 시

### 4. 기존 파일 마이그레이션 (선택)
PR 116 적용 후 기존 `public-images/wedding-snap/{user_id}/preprocessed/...` 같은
PII 파일은 `scripts/migrate-snap-to-private.mjs --execute` 로 private 버킷 이동.
미실행 시 기존 URL 은 그대로 동작, 신규 업로드만 private 으로 감.

### 5. 약관 / 처리방침 검토
- `/legal/snap-terms` 와 `/legal/snap-privacy` 페이지 본문 확인
- 변호사 검토 권장 (보유 기간 / 외부 위탁 표 / 외부 채널 노출 동의 문구)
- 변경 시 `src/lib/snap/consent.ts` 의 `SNAP_CONSENT_VERSION` 증가 → 자동 재동의

## 비용 변화 (1장당)

이전 (PR 114 적용 전):
- gen + face-swap + harmonize + finishing = ~$0.11

이후 (전체 PR 적용 + default 설정):
- 위 + Topaz upscale (+$0.015) + face similarity (+$0.003) = **~$0.13**
- 커플 모드: 추가 face-swap 2회 (+$0.02) = **~$0.15**

`snap_jobs.fal_cost_usd` 컬럼으로 실시간 모니터링 가능.

## 머지 후 검증

각 PR 의 Test plan 섹션 체크리스트를 따라 동작 확인:
- 신규 catalog 생성 → 결과 정상
- 커플 모드 → 얼굴 보존 개선 (PR 120)
- 야경/골든아워 조합 카탈로그 → 호환성 배지 (PR 121)
- snap_jobs 새 컬럼들 모두 값이 채워지는지 (PR 114, 119, 120)
- 동의 모달 → 진입 시 자동 노출 (PR 118)
- private 버킷 → 다른 사용자 파일 차단 (PR 116, 정책 적용 후)

문제 발생 시 어느 PR 단계에서 회귀가 생겼는지 `snap_jobs.pipeline_stages` /
`phase_timings` 로 추적.
