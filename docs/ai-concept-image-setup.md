# AI 웨딩 이미지 (컨셉형) 적용 가이드

이 문서는 새로 추가된 AI 컨셉 이미지 기능(`AI 이미지` 탭)을 운영 환경에 붙이는
법을 설명합니다. 코드 수정 없이 **fal.ai API 키 1개**와 **DB 마이그레이션 1회**
만 적용하면 동작합니다.

---

## 1. fal.ai API 키 발급

1. <https://fal.ai/dashboard/keys> 에서 키 1개를 발급받습니다.
2. 환경 변수로 등록합니다.

   ```env
   # .env.local (로컬) 또는 Vercel/배포 플랫폼의 환경변수
   FAL_KEY=fal-...
   ```

3. fal.ai 계정에 OpenAI 결제권이 활성화되어 있어야 `gpt-image-1/edit-image`
   엔드포인트를 호출할 수 있습니다. 대시보드 좌측의 **Billing → OpenAI Image
   credits** 항목이 0 이상이어야 하며, 충전이 안 되어 있으면 fal.ai 가
   `payment_required` 오류를 돌려줍니다.

> 변수 이름은 반드시 `FAL_KEY` 입니다. (`FAL_API_KEY` 아님 — `@fal-ai/client`
> SDK 가 기본적으로 `FAL_KEY` 를 읽습니다. 혹시 다른 이름을 쓰고 있다면
> `src/lib/fal/client.ts` 의 `process.env.FAL_KEY` 한 줄만 바꾸세요.)

---

## 2. Supabase 마이그레이션

`supabase/migrations/006_ai_usage.sql` 을 적용해 사용자 1명당 1회 제한을
강제하는 테이블을 생성합니다.

```bash
# Supabase CLI 가 설치돼 있다면
supabase db push

# 또는 SQL Editor 에서 006_ai_usage.sql 내용을 그대로 실행
```

마이그레이션이 끝나면 `public.ai_image_usage` 테이블이 생기고, RLS 가 켜진
상태로 사용자가 자기 행만 SELECT 할 수 있게 됩니다. INSERT/UPDATE 는 API
라우트(service-role 클라이언트) 만 수행합니다.

---

## 3. Storage 버킷 확인

기존에 이미 만들어 둔 버킷을 그대로 사용합니다.

| 버킷 | 용도 |
| --- | --- |
| `private-uploads` | 사용자가 업로드한 원본 사진 (1시간 signed URL 로 fal.ai 가 페치) |
| `public-images` | AI 생성 결과 — `ai-results/{user_id}/...` 경로에 저장됨 |

추가 버킷 생성은 필요 없습니다.

---

## 4. 라우트 / 컴포넌트 위치

| 경로 | 설명 |
| --- | --- |
| `src/lib/fal/concepts.ts` | 5가지 컨셉 카탈로그 + 마스터 프롬프트 빌더 |
| `src/lib/fal/client.ts` (`submitImageEdit / getImageEditStatus / getImageEditResult`) | fal.ai 큐 모드 래퍼 |
| `src/app/api/ai/concept-generate/route.ts` | POST=큐 제출(requestId 반환) / GET=잔여 쿼터 조회 |
| `src/app/api/ai/concept-status/route.ts` | GET=fal.ai 큐 작업 상태 조회 (폴링) |
| `src/app/api/ai/concept-finalize/route.ts` | POST=완료된 결과를 우리 Storage 에 저장 + 사용량 +1 |
| `src/components/editor/AIPanel.tsx` | 에디터 우측 "AI 이미지" 탭 진입점 |
| `src/components/editor/AIImageGenerator.tsx` | 업로드 → 컨셉 선택 → 큐 제출 → 폴링 → 다운로드 UI |

---

## 5. 동작 흐름 (큐 모드)

`fal.subscribe` (블로킹) 대신 `fal.queue.submit/status/result` 로 분리해 각 함수
호출이 5초 안쪽으로 끝납니다. **Vercel Hobby 의 60s 함수 제한과 무관하게 동작**.

```
사용자 업로드 (private-uploads)
        │
        ▼  signed URL 1시간
POST /api/ai/concept-generate                 ← 1–3초
        │
        ├─ ai_image_usage 조회 (user_id 단위)
        │     └─ used_count >= 1  →  403 quota_exhausted
        │
        ├─ fal.queue.submit(buildConceptPrompt(concept))
        │
        └─ { requestId } 즉시 반환

클라이언트가 5초 간격으로 폴링:
GET /api/ai/concept-status?id={requestId}     ← 0.5–1초
        ├─ status: IN_QUEUE / IN_PROGRESS  →  계속 폴링
        ├─ status: FAILED                  →  에러 표시
        └─ status: COMPLETED               →  finalize 호출

POST /api/ai/concept-finalize                 ← 3–5초
        │
        ├─ 쿼터 재확인
        ├─ fal.queue.result → 결과 URL
        ├─ 결과를 public-images 버킷에 저장 (ai-results/{user_id}/...)
        └─ ai_image_usage upsert (used_count += 1, last_image_path)
```

`GET /api/ai/concept-generate` 는 진입 시 한 번 호출돼 잔여 사용 가능 여부 +
마지막 결과 URL 을 받아 UI 분기에 사용합니다.

새로고침 안전장치: 진행 중이던 `requestId` 는 `sessionStorage.mw_ai_active_request`
에 저장되어 페이지 새로고침 후에도 폴링을 이어갈 수 있습니다.

---

## 6. 컨셉 추가/수정

`src/lib/fal/concepts.ts` 의 `AI_CONCEPTS` 객체에 항목을 추가하면 끝입니다.
프롬프트 마스터 템플릿은 그대로 공유되며, `vars.background / vars.groom /
vars.bride` 만 컨셉별로 다르게 두면 됩니다.

---

## 7. 자주 막히는 부분

- **"AI 키 설정이 누락되었습니다"** → 서버에 `FAL_KEY` 가 안 들어와 있는 경우.
  로컬은 `.env.local`, Vercel 등은 환경변수 패널에 등록 후 재배포.
- **fal.ai 가 `payment_required` 반환** → fal.ai 대시보드에서 OpenAI Image
  credits 가 0 입니다. 충전 후 재시도.
- **결과는 받았는데 사용량이 1로 안 올라감** → `ai_image_usage` 테이블이
  마이그레이션되지 않았을 가능성. 위 2단계 다시 확인.
- **계정당 1회 제한을 초기화하고 싶다** →
  `delete from public.ai_image_usage where user_id = '...';` 로 행을 지우면
  다시 1회 사용 가능합니다.
- **`Unexpected token 'A', "An error o"...` 가 화면에 보였다** → 이전 동기 모드
  (fal.subscribe) 에서 Vercel 함수 타임아웃 시 발생하던 증상. 큐 모드로 전환된
  현재는 발생하지 않아야 합니다. 만약 여전히 보인다면 `concept-status` 폴링
  라우트 자체가 타임아웃 났을 가능성 — fal.ai 가 응답을 5–10초 이상 끌고 있는
  경우라 잠시 후 새로고침으로 폴링 재개됩니다 (sessionStorage 의 active
  requestId 가 자동 복구).
