-- 024_snap_column_comments.sql
--
-- 웨딩스냅 관련 테이블·컬럼 상세 설명 (COMMENT ON) 일괄 추가.
--
-- 기능 변경 없음 — 메타데이터만 갱신. 모든 COMMENT 는 idempotent (재실행 안전).
-- Supabase Studio 컬럼 hover, pgAdmin / dbeaver / DataGrip 의 introspection
-- 도구에서 도움말 / 툴팁으로 표시됨.
--
-- 적용 대상:
--   - snap_jobs              (PR 114, 119, 120 까지 누적 컬럼)
--   - snap_consent           (PR 118)
--   - snap_anchors           (기존)
--   - snap_anchor_history    (기존)
--   - snap_credits_ledger    (기존)
--   - 주요 RPC 함수 (consume_snap_credit, refund_snap_credit, snap_has_required_consent)

-- ═════════════════════════════════════════════════════════════
-- snap_jobs
-- ═════════════════════════════════════════════════════════════

comment on table public.snap_jobs is
  '웨딩스냅 단위 작업 로그. anchor / catalog 생성 1건 = row 1.
   상태 전이: submitted → in_progress → completed / failed / timeout.
   failed/timeout 으로 전이 시 자동 환불 트리거(019) 발화 → credit_delta 가 음수면 같은 양만큼 refund_snap_credit 호출.
   finalize 단계가 모든 후처리(face-swap / harmonize / finishing / upscale / sharpen) 를 거친 뒤 result_url + 비용/타이밍 메타를 채움.';

comment on column public.snap_jobs.id is
  'PK. gen_random_uuid().';

comment on column public.snap_jobs.user_id is
  '작업 소유자. auth.users(id) FK. 환불 / 라이브러리 / RLS 격리 키.';

comment on column public.snap_jobs.kind is
  '''anchor'' = 셀카 → 정면/반신 anchor 4장 batch. ''catalog'' = anchor 또는 커플 사진 기반으로 카탈로그 컷 1장 생성.';

comment on column public.snap_jobs.fal_request_id is
  'fal.queue.submit 의 request_id. fal 결과 조회 키 + webhook 콜백 매칭 키. UNIQUE.';

comment on column public.snap_jobs.model is
  'fal 모델 id 문자열. 현재 openai/gpt-image-2/edit 만 사용. 추후 모델 교체 시 분기용.';

comment on column public.snap_jobs.quality is
  'gpt-image-2 quality 파라미터 — ''low'' | ''medium'' | ''high'' | ''auto''. 카탈로그=medium, anchor=high.';

comment on column public.snap_jobs.catalog_id is
  '''catalog'' kind 일 때 카탈로그 id (예: bridge-goldenhour). anchor kind 면 NULL.';

comment on column public.snap_jobs.catalog_path is
  '''anchored'' = anchor → catalog (셀카 모드 정상 흐름)
   ''selfies''  = (레거시, 현재 anchored 와 통합)
   ''couple''   = 커플 사진 직결 → catalog
   anchor kind 작업은 NULL.';

comment on column public.snap_jobs.anchor_slot is
  '''anchor'' kind 한정. ''groom'' / ''bride''. catalog kind 는 NULL.';

comment on column public.snap_jobs.anchor_framing is
  '''anchor'' kind 한정. ''closeup'' (얼굴 클로즈업) / ''halfbody'' (반신). catalog kind 는 NULL.';

comment on column public.snap_jobs.status is
  '상태 전이:
     submitted    : fal 큐 제출 직후 (기본)
     in_progress  : finalize 시도 중 (현재 미사용, 향후 progress 표시용)
     completed    : finalize 성공, result_url 채워짐
     failed       : finalize 실패 또는 fal ERROR 콜백 — 환불 트리거 발화
     timeout      : 큐 대기 시간 초과 (poll-pending 의 cutoff) — 환불 트리거 발화';

comment on column public.snap_jobs.result_url is
  'finalize 완료 후 public-images 버킷의 최종 jpg URL. status=''completed'' 일 때만 채워짐.';

comment on column public.snap_jobs.credit_delta is
  '이 작업이 차감한 크레딧 수 (음수). 예: 카탈로그 1장 = -1, anchor full batch = -4.
   환불 트리거가 이 값의 절댓값만큼 refund 처리.
   무료 작업은 0.';

comment on column public.snap_jobs.error_message is
  'failed 시 에러 메시지 (사용자에 노출되지 않음, 디버깅용). completed 시 NULL.';

comment on column public.snap_jobs.submitted_at is
  '작업 제출 시각 (default now()). 큐 대기 시간 분석에 사용.';

comment on column public.snap_jobs.completed_at is
  'status=completed/failed/timeout 으로 전이된 시각. NULL 이면 아직 종결 안 됨.';

-- ── PR 119 — face similarity 측정 ─────────────────────────────
comment on column public.snap_jobs.face_similarity_groom is
  '신랑 얼굴 ArcFace cosine similarity. 0..1 (1=동일 인물, 0.5+=동일 판정 가능, <0.3=다른 사람).
   finalize 단계에서 비차단 측정 → 측정 실패 시 NULL. 자동 환불 X (분석용).';

comment on column public.snap_jobs.face_similarity_bride is
  '신부 얼굴 ArcFace cosine similarity. solo 작업이면 NULL. 현재는 1개 reference 만 측정해 보통 NULL — 추후 per-face score 확장 가능.';

comment on column public.snap_jobs.face_similarity_ref is
  'similarity 측정 시 reference 이미지 종류:
     ''selfie''       = snap_anchors.groom/bride_selfie_url
     ''anchor''       = 앵커 이미지 (현재 미사용, 향후 확장)
     ''couple_input'' = 사용자 업로드 커플 사진 (couple_photo_url)';

-- ── PR 120 — 커플 사진 reference 보존 ────────────────────────
comment on column public.snap_jobs.couple_photo_url is
  '''couple'' catalog_path 한정. 사용자가 업로드한 (선처리된) 커플 사진 URL.
   finalize 단계의 applyCoupleFaceSwapRestore + face similarity 측정에 사용.';

comment on column public.snap_jobs.couple_photo_path is
  '''couple'' catalog_path 한정. private-uploads 버킷 내 객체 경로.
   PR 116 적용 후 signed URL 만료 시 재발급용. couple_photo_url 과 일치.';

-- ── PR 114 — 비용 / 타이밍 / 입력 메타 ────────────────────────
comment on column public.snap_jobs.fal_cost_usd is
  '추정 fal 비용 USD. numeric(8,4) 0.0001 단위.
   gen + face-swap + birefnet + flux img2img + upscale (각 단계 활성화 시) 합산.
   COST_ESTIMATES_USD 상수 기반 — 실제 청구와 ±10% 차이 가능.';

comment on column public.snap_jobs.phase_timings is
  'JSONB. 각 finalize 단계 소요 ms:
     { fal_wait_ms, face_swap_ms, postprocess_ms, storage_upload_ms, ... }
   특정 단계가 느려지는지 / fal 큐 대기가 폭증하는지 모니터링.';

comment on column public.snap_jobs.pipeline_stages is
  'JSONB. 어떤 후처리 단계가 실제 실행됐는지 토글 상태 스냅샷:
     { face_swap: true/false, harmonize: ''masked''|''off'', finishing: ''img2img''|''off'',
       upscale: ''topaz-sharpen''|''aura-sharpen''|''off'' }
   env 토글 변경 후 결과 회귀 추적용.';

comment on column public.snap_jobs.input_face_count is
  '입력 사진의 검출된 얼굴 수 (fal face-detection). NULL = 측정 안 함 / 실패.
   커플 모드에서 2 가 아니면 사용자에게 경고.';

comment on column public.snap_jobs.input_face_min_size is
  '입력 사진 내 가장 작은 얼굴의 짧은 변 픽셀 수. 120 미만이면 face fidelity 저하 위험.';

comment on column public.snap_jobs.input_avg_luminance is
  '입력 사진 평균 luminance 0..255. 야경/저조도 입력 (< 70) 에서 강한 backlight 카탈로그 조합 risk 분석용.';

-- ═════════════════════════════════════════════════════════════
-- snap_consent (PR 118)
-- ═════════════════════════════════════════════════════════════

comment on table public.snap_consent is
  '스냅 PII / AI 합성 / 외부 공유 동의 기록. scope 별로 가장 최신 row 가 현재 상태.
   한국 PIPA / 정보통신망법 대응. 약관 본문 변경 시 SNAP_CONSENT_VERSION 증가로 재동의 강제.
   사용자는 RLS 로 자기 row 만 select. INSERT 는 service role 만 (위변조 방지).';

comment on column public.snap_consent.id is
  'PK. gen_random_uuid().';

comment on column public.snap_consent.user_id is
  '동의 주체. auth.users(id) FK. ON DELETE CASCADE — 회원 탈퇴 시 자동 정리.';

comment on column public.snap_consent.scope is
  '동의 범위:
     ''personal_info''   = (필수) 얼굴 등 PII 의 저장/분석/처리
     ''ai_generation''   = (필수) AI 합성 + 제3자(fal.ai) 처리 위탁
     ''external_share''  = (선택) 식별 정보 제거한 결과 이미지의 외부 채널 노출';

comment on column public.snap_consent.version is
  '동의한 약관 버전 (정수). src/lib/snap/consent.ts 의 SNAP_CONSENT_VERSION 과 비교.
   약관 본문 변경 시 +1 → 사용자는 다음 작업 시도 시 재동의 모달 자동 노출.';

comment on column public.snap_consent.accepted is
  'true = 동의, false = 철회. 같은 user_id + scope 의 가장 최근 row 가 현재 상태.
   철회 시 새 row 를 accepted=false 로 insert (덮어쓰기 X).';

comment on column public.snap_consent.accepted_at is
  '동의 / 철회 시점 (default now()). 감사 추적 + 보유 기간 산정 기준.';

comment on column public.snap_consent.user_agent is
  '동의 시점 브라우저 UA 문자열. 분쟁 / 감사 대응. 최대 ~512 bytes.';

comment on column public.snap_consent.ip_address is
  '동의 시점 IP. x-forwarded-for 의 첫 값 또는 x-real-ip. 감사용 — 한정된 기간만 보유 권장.';

-- ═════════════════════════════════════════════════════════════
-- snap_anchors
-- ═════════════════════════════════════════════════════════════

comment on table public.snap_anchors is
  '사용자별 현재 활성 앵커 (신랑/신부 정면 합성 결과 + 입력 셀카 reference).
   user_id 당 row 1개 (UNIQUE). 새 anchor batch 시 기존 row 가 완성 앵커면 snap_anchor_history 로 자동 백업.';

comment on column public.snap_anchors.user_id is
  '앵커 소유자. PK — 사용자당 1행만. auth.users(id) FK ON DELETE CASCADE.';

comment on column public.snap_anchors.groom_anchor_url is
  '신랑 정면 합성 anchor URL (fal 결과 + 후처리). NULL = 아직 생성 안 함 / 폐기됨. (013 마이그 추가)';

comment on column public.snap_anchors.bride_anchor_url is
  '신부 정면 합성 anchor URL. NULL 가능.';

comment on column public.snap_anchors.groom_selfie_url is
  '신랑 input 셀카 URL (3장 중 정면 1장 또는 첫 장). face-swap 단계의 identity reference.
   PR 116 적용 후 private-uploads 버킷의 signed URL.';

comment on column public.snap_anchors.bride_selfie_url is
  '신부 input 셀카 URL. groom_selfie_url 과 동일 정책.';

comment on column public.snap_anchors.source_mode is
  '''selfies'' = 셀카 3장 입력으로 anchor 생성. ''couple'' = 커플 사진 1장 입력 (레거시, 현재 catalog_path=couple 분기로 통합).';

comment on column public.snap_anchors.groom_height_cm is
  '신랑 키 cm (140-210). 체형 reference. NULL = 미입력.';

comment on column public.snap_anchors.groom_weight_kg is
  '신랑 몸무게 kg (35-150). 체형 reference.';

comment on column public.snap_anchors.bride_height_cm is
  '신부 키 cm (140-210).';

comment on column public.snap_anchors.bride_weight_kg is
  '신부 몸무게 kg (35-150).';

comment on column public.snap_anchors.free_full_batches_used is
  '결제 사용자의 무료 full-batch 사용 횟수 (0/1/2). 정책:
     - 결제 사용자: 최대 2회 (최초 + 재생성 1회)
     - 미결제 사용자: 0회 (첫 batch 부터 유료, 4 크레딧)
   부분 재생성은 항상 유료라 이 카운터에 영향 X.';

comment on column public.snap_anchors.last_batch_at is
  '가장 최근 anchor batch 생성 시각. 무료 활성화 소비 여부 판별용.';

comment on column public.snap_anchors.created_at is
  '행 생성 시각.';

comment on column public.snap_anchors.updated_at is
  '행 마지막 갱신 시각. touch_snap_anchor_updated_at 트리거가 자동 갱신.';

-- ═════════════════════════════════════════════════════════════
-- snap_anchor_history
-- ═════════════════════════════════════════════════════════════

comment on table public.snap_anchor_history is
  '과거 완성 앵커 라이브러리. 새 anchor batch 직전 기존 snap_anchors 가 양쪽 URL 모두 채워졌으면 자동 복사.
   사용자가 카탈로그 생성 시 anchorId=UUID 로 과거 앵커를 선택 가능.
   user_id + id 가 RLS 격리.';

comment on column public.snap_anchor_history.id is
  'PK. 카탈로그 생성 시 anchorId 로 사용.';

comment on column public.snap_anchor_history.user_id is
  '앵커 소유자 (RLS).';

comment on column public.snap_anchor_history.groom_anchor_url is
  '백업 시점의 신랑 anchor URL.';

comment on column public.snap_anchor_history.bride_anchor_url is
  '백업 시점의 신부 anchor URL.';

comment on column public.snap_anchor_history.groom_selfie_url is
  '백업 시점의 신랑 셀카 reference URL. 카탈로그 생성 시 face-swap 단계에 사용. PR 017 마이그 이후 추가된 컬럼.';

comment on column public.snap_anchor_history.bride_selfie_url is
  '백업 시점의 신부 셀카 reference URL. PR 017 마이그 이후 추가.';

comment on column public.snap_anchor_history.source_mode is
  '원본 앵커가 만들어진 입력 모드 — ''selfies'' (셀카 3장) 또는 ''couple'' (커플 사진).';

comment on column public.snap_anchor_history.groom_height_cm is
  '백업 시점의 신랑 키 cm.';

comment on column public.snap_anchor_history.groom_weight_kg is
  '백업 시점의 신랑 몸무게 kg.';

comment on column public.snap_anchor_history.bride_height_cm is
  '백업 시점의 신부 키 cm.';

comment on column public.snap_anchor_history.bride_weight_kg is
  '백업 시점의 신부 몸무게 kg.';

comment on column public.snap_anchor_history.anchor_created_at is
  '원래 snap_anchors 행의 created_at — 앵커가 처음 만들어진 시점. 라이브러리 정렬용.';

comment on column public.snap_anchor_history.discarded_at is
  '히스토리로 백업된 시각 (= 새 anchor batch 로 대체된 시각). 기본 now().';

-- ═════════════════════════════════════════════════════════════
-- snap_credits_ledger
-- ═════════════════════════════════════════════════════════════

comment on table public.snap_credits_ledger is
  '스냅 크레딧 잔액 변동 이력 (append-only).
   잔액 = 사용자의 모든 row delta 합. 충전(양수) / 차감(음수) / 환불(양수) 모두 기록.
   consume_snap_credit / refund_snap_credit / grant_welcome_snap_credit RPC 만 INSERT 가능.';

comment on column public.snap_credits_ledger.id is
  'PK.';

comment on column public.snap_credits_ledger.user_id is
  '크레딧 변동 대상.';

comment on column public.snap_credits_ledger.delta is
  '크레딧 변동량 (integer). 양수 = 충전/환불, 음수 = 차감.
   사용자 잔액 = sum(delta) over (user_id) — snap_credits_balance(uid) RPC 가 동일 계산.';

comment on column public.snap_credits_ledger.reason is
  '이벤트 종류 (check 제약):
     ''purchase''         = 패키지 구매로 적립
     ''consume''          = 작업 1건 차감
     ''refund''           = 작업 실패 환불 (트리거 019 자동 또는 운영자 수동)
     ''legacy_migration'' = 기존 ai_snap 잔액 일괄 이관
     ''admin_grant''      = 운영자 수동 적립 (보상/이벤트)
     ''admin_revoke''     = 운영자 수동 차감 (어뷰징 대응 등)';

comment on column public.snap_credits_ledger.ref_table is
  '관련 테이블 이름 — 예: ''snap_jobs'', ''purchase_orders''. 디버깅 / 추적용.';

comment on column public.snap_credits_ledger.ref_id is
  '관련 외부 식별자 (uuid). ''consume'' / ''refund'' 의 경우 snap_jobs.id 와 매칭 가능.';

comment on column public.snap_credits_ledger.note is
  '자유 텍스트 메모 — 디버깅 / 운영 대응용 (예: ''catalog bridge-goldenhour'', ''fal timeout'').';

comment on column public.snap_credits_ledger.created_at is
  '이벤트 발생 시각.';

-- ═════════════════════════════════════════════════════════════
-- RPC 함수 설명
-- ═════════════════════════════════════════════════════════════

comment on function public.consume_snap_credit(uuid, text) is
  '원자적 크레딧 차감. 잔액 부족 시 { ok:false, balance } 반환, 차감 안 됨.
   성공 시 { ok:true, balance } + snap_credits_ledger 에 delta=-1 row 추가.';

comment on function public.refund_snap_credit(uuid, text, text) is
  '크레딧 환불. snap_credits_ledger 에 delta=+N row 추가.
   019 트리거가 snap_jobs.status → failed/timeout 시 자동 호출.';

comment on function public.snap_has_required_consent(uuid, integer) is
  '필수 scope(personal_info, ai_generation) 모두 지정 version 이상으로 accepted=true 인지 확인.
   src/lib/snap/consent.ts 의 SNAP_CONSENT_VERSION 을 인자로 전달.';
