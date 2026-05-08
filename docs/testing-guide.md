# 우리다운 — 결제·발행·소장용·통계 테스트 가이드

PortOne / 네이버 스마트스토어 결제 흐름을 직접 태우지 않고도 **Supabase SQL
Editor 에서 몇 줄만 실행**하면 발행권·영구소장·AI 패키지·통계 데이터를 자유롭게
세팅·초기화할 수 있다. 각 시나리오를 단계별로 정리.

> ⚠️ 모든 SQL 은 **service-role 권한**(Supabase Dashboard SQL Editor 또는
> `psql` 으로 service-role 키 사용) 으로 실행해야 한다. 클라이언트 anon 키로는
> RLS 에 막힌다.
>
> 실 사용자 데이터를 갱신할 때는 **`user_id`** 를 정확히 한정해 다른 계정에
> 영향이 없게 하자. 본인 계정의 user_id 는 다음 쿼리로 확인:
>
> ```sql
> -- 네이버 nickname 으로 찾기
> select u.id, u.email, n.nickname
>   from auth.users u
>   left join public.naver_accounts n on n.user_id = u.id
>  order by u.created_at desc;
> ```

### 자주 마주치는 체크 제약 (먼저 읽고 시작)

| 컬럼 | 허용값 |
| --- | --- |
| `publish_credits_ledger.reason` | `purchase`, `publish`, `admin_grant`, `admin_revoke`, `refund` |
| `archive_credits_ledger.reason` | (체크 제약 없음 — 자유 텍스트) |
| `purchase_orders.source` | `portone`, `naver_smartstore`, `manual` |
| `purchase_orders.status` | `pending`, `completed`, `failed`, `refunded` |

QA 직접 충전 시 publish 쪽은 **`admin_grant`(+) / `admin_revoke`(-)** 를 사용. 다른 값(`'manual'` 등) 을 넣으면
`publish_credits_ledger_reason_check` 에 막힌다.

---

## 0. 환경 준비 — 마이그레이션 적용 확인

```sql
-- 적용된 마이그레이션 (003 + 008 까지) 확인
select code, name, price, publish_credits_grant, sort_order
  from public.addon_packages
 order by sort_order;
```

**기대 결과** (008 까지 적용 시):

| code | name | price | grant |
| --- | --- | --- | --- |
| basic | 기본 발행권 패키지 | 9900 | 2 |
| archive_basic | 영구소장 패키지 | 14900 | 0 |
| ai_snap | AI 웨딩 스냅 패키지 | 19900 | 0 |
| ai_video | AI 웨딩 영상 패키지 | 29900 | 0 |
| family_pack | 가족 패키지 | 9900 | 0 |

비어 있거나 4개 이하면 마이그레이션을 다시 적용하자 (`supabase db push` 또는
`supabase/migrations/008_archive_and_packages.sql` 직접 실행).

---

## 1. 발행권 (publish credits) 테스트

### 시나리오 A — 발행권 잔량 확인

```sql
select public.publish_credits_balance('<USER_ID>'::uuid) as publish_credits;
```

또는 마이페이지 → "발행권 · 영구소장" 탭에서도 동일한 값 확인 가능.

### 시나리오 B — 발행권 N개 즉시 충전 (PortOne / 네이버 결제 우회)

```sql
-- grant_purchase_credits 가 표준 경로. 'basic' 패키지 1건 = 발행권 +2.
-- 결제 흐름을 거치지 않고 ledger 에 직접 +N 을 꽂아도 동일하게 동작.
-- ⚠️ reason 은 ('purchase','publish','admin_grant','admin_revoke','refund') 중에서만 허용.
insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
values ('<USER_ID>'::uuid, 5, 'admin_grant', null, null, 'qa-grant');

-- 결과 확인
select public.publish_credits_balance('<USER_ID>'::uuid);  -- → 기존 잔량 + 5
```

### 시나리오 C — 발행권 0 으로 초기화 (사용 흐름 스트레스 테스트)

```sql
-- 현재 잔량을 음수로 상쇄하는 ledger 행 추가.
with bal as (
  select public.publish_credits_balance('<USER_ID>'::uuid) as v
)
insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
select '<USER_ID>'::uuid, -bal.v, 'admin_revoke', null, null, 'qa-reset' from bal;
```

이후 발행 시도 → "발행권이 부족합니다" 에러 + 402 응답 확인.

### 시나리오 D — 결제 시뮬레이션 (네이버 스마트스토어 주문번호)

`/api/orders/register` 가 `grant_purchase_credits` RPC 를 호출한다. SQL 로 같은
효과를 내려면:

```sql
select public.grant_purchase_credits(
  p_user_id          := '<USER_ID>'::uuid,
  p_source           := 'naver_smartstore',
  p_package_code     := 'basic',
  p_amount           := 9900,
  p_naver_order_no   := 'TEST-ORDER-001',
  p_naver_product_no := '11111111'
);
```

마이페이지 "주문" 탭에 새 주문이 보이고, 발행권 +2 가 반영된다.

> 멱등성: 같은 `naver_order_no` 로 다시 호출해도 발행권은 한 번만 지급.

---

## 2. 발행 (publish) 테스트

### 시나리오 A — 정상 발행 (UI)

1. 알림장 편집 → 우상단 "저장" → 마이페이지로 이동
2. 해당 행의 "발행" 버튼 → 모달 → "발행하기"
3. 발행권 -1, 새 publications row 생성. 마이페이지에 하객용 + 소장용 URL 노출

### 시나리오 B — 발행 직접 호출 (RPC)

```sql
-- 새 슬러그 + owner_token 직접 발급 (UI 우회).
select public.publish_invitation_v4(
  inv_id        := '<INVITATION_ID>'::uuid,
  new_slug      := 'qatest1',  -- 8자 안쪽 영소문자/숫자
  new_owner_tok := 'qaowner1234567890'  -- 16자 권장
);
```

반환값:
```json
{
  "publication_id": "...",
  "slug": "qatest1",
  "owner_token": "qaowner1234567890",
  "expires_at": "<wedding_date + 30일>"
}
```

→ 브라우저: `http://localhost:3000/qatest1` (하객용),
   `http://localhost:3000/qatest1/o/qaowner1234567890` (소장용)

### 시나리오 C — 만료 테스트 (결혼식 날짜 + 30일 후)

```sql
-- publications.expires_at 을 어제로 강제 → 하객용 URL 만료.
update public.publications
   set expires_at = now() - interval '1 day'
 where slug = 'qatest1';
```

브라우저에서 `/qatest1` 진입 → "발행 후 30일이 지나 비공개" 화면.
소장용 `/qatest1/o/...` 도 동일하게 막힘 (영구소장 미적용 시).

### 시나리오 D — 발행 취소 (revoke)

```sql
update public.publications
   set revoked_at = now()
 where slug = 'qatest1';
```

이후 진입 → notFound (404).

---

## 3. 영구소장 (archive) 테스트

### 시나리오 A — 영구소장권 충전

```sql
-- 5개 즉시 지급
-- (archive_credits_ledger.reason 은 자유 텍스트라 'manual' 도 허용. publish 와 다름에 주의.)
insert into public.archive_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
values ('<USER_ID>'::uuid, 5, 'admin_grant', null, null, 'qa-archive-grant');

select public.archive_credits_balance('<USER_ID>'::uuid);
```

마이페이지 헤더의 "영구소장" 카운트가 +5.

### 시나리오 B — `archive_basic` 패키지 결제 시뮬레이션

```sql
select public.grant_purchase_credits(
  p_user_id          := '<USER_ID>'::uuid,
  p_source           := 'naver_smartstore',
  p_package_code     := 'archive_basic',
  p_amount           := 14900,
  p_naver_order_no   := 'TEST-ARCH-001',
  p_naver_product_no := '22222222'
);
-- → archive_credits +2
```

### 시나리오 C — 영구소장 적용 (UI)

1. 마이페이지 → 발행된 알림장 행 → 소장용 URL 아래 "영구소장 적용" 버튼
2. 클릭 → `archived = true`, archive credit -1, 배지 "영구소장" 표시

### 시나리오 D — 영구소장 직접 적용 (RPC)

```sql
-- publications.id 를 받아 archived = true + ledger -1
select public.apply_archive('<PUBLICATION_ID>'::uuid);
```

### 시나리오 E — 영구소장 효과 확인

```sql
-- 영구소장된 publication 의 expires_at 을 과거로 만들어도 owner URL 은 살아 있어야 함.
update public.publications
   set archived = true, expires_at = now() - interval '60 days'
 where slug = 'qatest1';
```

- `/qatest1` (하객용) → 만료(404) ✓
- `/qatest1/o/...` (소장용) → 정상 진입 ✓

### 시나리오 F — 영구소장 해제 (테스트 다시)

```sql
update public.publications set archived = false where slug = 'qatest1';
-- 환불은 별도 ledger 행으로 (음수 → 양수 보정)
insert into public.archive_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
values ('<USER_ID>'::uuid, 1, 'admin_grant', 'publications', '<PUB_ID>'::uuid, 'qa-archive-revert');
```

---

## 4. AI 스냅 / AI 영상 / 가족 패키지 (entitlement)

이 셋은 ledger 가 없고 `purchase_orders` 1행 = 영구 잠금해제다.

### 시나리오 A — entitlement 부여

```sql
-- AI 스냅 잠금 해제
select public.grant_purchase_credits(
  p_user_id        := '<USER_ID>'::uuid,
  p_source         := 'naver_smartstore',
  p_package_code   := 'ai_snap',
  p_amount         := 19900,
  p_naver_order_no := 'TEST-AISNAP-001',
  p_naver_product_no := '33333333'
);
```

마찬가지로 `ai_video`, `family_pack` 코드 변경하면 됨.

### 시나리오 B — entitlement 확인

```sql
select
  public.user_has_package('<USER_ID>'::uuid, 'ai_snap')   as ai_snap,
  public.user_has_package('<USER_ID>'::uuid, 'ai_video')  as ai_video,
  public.user_has_package('<USER_ID>'::uuid, 'family_pack') as family_pack;
```

또는 클라이언트에서:
```bash
curl -H "Cookie: <세션쿠키>" http://localhost:3000/api/me/entitlements
```

### 시나리오 C — 잠금 해제 회수

```sql
-- 가장 단순한 방법: 해당 row 삭제.
delete from public.purchase_orders
 where user_id = '<USER_ID>'::uuid
   and package_code = 'ai_snap';
```

> 실제 운영에선 환불 로직이 별도이지만, 테스트 목적이라면 직접 삭제로 충분.

---

## 5. AI 이미지 사용 (계정당 1회 무료)

### 시나리오 A — 무료 1회 사용 여부

```sql
select used_count, last_image_path, last_used_at
  from public.ai_image_usage
 where user_id = '<USER_ID>'::uuid;
```

- 행이 없으면 → 무료 1회 사용 가능
- `used_count >= 1` → 추가 생성 차단

### 시나리오 B — 무료 1회 다시 사용 가능하게 초기화

```sql
delete from public.ai_image_usage where user_id = '<USER_ID>'::uuid;
```

이후 에디터 "AI 이미지" 탭 진입 → 무료 1회 사용 가능 상태로 돌아옴.

---

## 6. 하객 인터랙션 데이터

### 시나리오 A — 축하하기 카운트 임의 부풀리기

```sql
-- 메인 슬라이드 "축하하기" 카운트를 즉시 1234 로 세팅
insert into public.invitation_cheers (invitation_id, cheers_count, updated_at)
values ('<INVITATION_ID>'::uuid, 1234, now())
on conflict (invitation_id) do update
  set cheers_count = excluded.cheers_count, updated_at = now();
```

소장용 URL → 메인 슬라이드 "총 1,234번의 축하가 터졌습니다" 확인.

### 시나리오 B — 갤러리 사진별 좋아요

```sql
-- 0번 사진 = 12, 1번 사진 = 89 ...
insert into public.gallery_likes (invitation_id, image_index, like_count) values
  ('<INVITATION_ID>'::uuid, 0, 12),
  ('<INVITATION_ID>'::uuid, 1, 89),
  ('<INVITATION_ID>'::uuid, 2, 3)
on conflict (invitation_id, image_index) do update
  set like_count = excluded.like_count;
```

### 시나리오 C — 퀴즈 응답 채워 넣기 (정답률 시뮬레이션)

```sql
-- 0번 문항 — 30명 응답, 그중 18명 정답(answer=2 가정)
insert into public.quiz_responses (invitation_id, visitor_name, question_index, selected_option, is_correct)
select '<INVITATION_ID>'::uuid, 'qa-' || g, 0,
       case when g <= 18 then 2 else (g % 4) end,
       case when g <= 18 then true else false end
  from generate_series(1, 30) g;
```

### 시나리오 D — 투표 응답

```sql
insert into public.vote_responses (invitation_id, visitor_name, question_index, selected_option)
select '<INVITATION_ID>'::uuid, 'qa-' || g, 0, g % 2
  from generate_series(1, 50) g;
```

### 시나리오 E — 방명록 메시지 / 서명

```sql
-- 메시지
insert into public.guestbook_messages (invitation_id, visitor_name, message, consent_personal_info)
values
  ('<INVITATION_ID>'::uuid, '김하나', '두 분 행복하세요!', true),
  ('<INVITATION_ID>'::uuid, '이둘',   '오래오래 행복하시길', true),
  ('<INVITATION_ID>'::uuid, '박셋',   '축하드립니다 🙏', true);

-- 서명 (signature_data 는 base64 dataURL — 테스트용 빈 문자열)
insert into public.signatures (invitation_id, visitor_name, visitor_side, signature_data, consent_personal_info)
values
  ('<INVITATION_ID>'::uuid, '김하나', 'groom', '', true),
  ('<INVITATION_ID>'::uuid, '이둘',   'bride', '', true);
```

### 시나리오 F — 모두 비우기 (소장용 뷰 빈 상태 확인)

```sql
delete from public.invitation_cheers where invitation_id = '<INVITATION_ID>'::uuid;
delete from public.gallery_likes      where invitation_id = '<INVITATION_ID>'::uuid;
delete from public.quiz_responses     where invitation_id = '<INVITATION_ID>'::uuid;
delete from public.vote_responses     where invitation_id = '<INVITATION_ID>'::uuid;
delete from public.guestbook_messages where invitation_id = '<INVITATION_ID>'::uuid;
delete from public.signatures         where invitation_id = '<INVITATION_ID>'::uuid;
```

---

## 7. 14일 미발행 자동 삭제 cron 테스트

`vercel.json` 이 매일 04:00 KST 에 `/api/cron/cleanup-drafts` 를 호출.

### 시나리오 A — 강제 트리거

```bash
# 운영
curl -X POST https://<DOMAIN>/api/cron/cleanup-drafts \
  -H "Authorization: Bearer $CRON_SECRET"

# 로컬
curl -X POST http://localhost:3000/api/cron/cleanup-drafts \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 시나리오 B — 14일 경과 알림장 강제 만들기

```sql
update public.invitations
   set updated_at = now() - interval '15 days', is_published = false
 where id = '<INVITATION_ID>'::uuid;
```

cron 호출 → 해당 알림장이 삭제됨.

---

## 8. 기기간 동기화 / 자동 로그인 / 미리보기

### 시나리오 A — 자동 로그인 OFF 상태에서 재방문

1. 로그인 페이지에서 "자동 로그인" 체크 해제 → 네이버 로그인
2. 브라우저 종료 → 같은 도메인 재방문
3. 자동으로 `/login?reason=auto_login_off` 로 리다이렉트되는지 확인
4. 다시 로그인 페이지에서 "자동 로그인" 체크 → 로그인 → 재방문 시 그대로 유지되는지 확인

### 시나리오 B — 미리보기에서 작업한 데이터가 수집되지 않음을 확인

1. 알림장 편집 후 "미리보기" 진입
2. 메인 슬라이드 "축하하기" 클릭, 갤러리 하트 클릭
3. SQL 로 카운트 확인 → 변동 없어야 함

```sql
select cheers_count from public.invitation_cheers where invitation_id = '<INVITATION_ID>'::uuid;
select * from public.gallery_likes where invitation_id = '<INVITATION_ID>'::uuid;
```

발행 후 진입 시에만 카운트 증가.

---

## 9. 흔히 막히는 곳 — 빠른 진단

| 증상 | 1차 점검 |
| --- | --- |
| 발행 클릭 시 "발행권이 부족합니다" | `publish_credits_balance` 확인 → 시나리오 1-B 로 충전 |
| 영구소장 버튼 비활성 | 시나리오 3-A 로 영구소장권 충전 |
| AI 이미지 탭에서 "사용 정보를 불러오는 중..." 무한 로딩 | 시나리오 5-B 로 `ai_image_usage` 행 삭제 |
| 마이페이지 발행 행에 URL 안 보임 | `publications.revoked_at` / `expires_at` 확인 |
| 소장용 URL 만료 | 영구소장 적용(시나리오 3-D) 또는 `expires_at` 직접 갱신 |
| 결제 후 entitlement 가 안 잡힘 | `purchase_orders.status` 가 `completed` 인지 확인 |
| 마이그레이션 안 적용된 듯 | 시나리오 0 — `addon_packages` 행 5개 다 있는지 확인 |

---

## 10. 한 번에 깨끗한 테스트 계정 만드는 스크립트

다음을 한 트랜잭션으로 실행하면 본인 계정이 새 발행 흐름을 풀로 시뮬레이션할
수 있는 상태가 된다:

```sql
do $$
declare
  uid uuid := '<USER_ID>'::uuid;
begin
  -- 1) 발행권 +5
  --    ⚠️ publish_credits_ledger.reason 은 ('purchase','publish','admin_grant','admin_revoke','refund') 만 허용.
  insert into public.publish_credits_ledger (user_id, delta, reason, note)
  values (uid, 5, 'admin_grant', 'qa-bootstrap-publish');

  -- 2) 영구소장 +5
  --    archive_credits_ledger.reason 은 자유 텍스트(체크 제약 없음).
  insert into public.archive_credits_ledger (user_id, delta, reason, note)
  values (uid, 5, 'admin_grant', 'qa-bootstrap-archive');

  -- 3) AI 스냅 / AI 영상 / 가족 잠금 해제
  --    purchase_orders.source 는 ('portone','naver_smartstore','manual') 만 허용 → 'manual' OK.
  insert into public.purchase_orders (user_id, source, package_code, amount, granted_credits, status)
  values
    (uid, 'manual', 'ai_snap',     19900, 0, 'completed'),
    (uid, 'manual', 'ai_video',    29900, 0, 'completed'),
    (uid, 'manual', 'family_pack',  9900, 0, 'completed');

  -- 4) AI 이미지 사용 이력 초기화
  delete from public.ai_image_usage where user_id = uid;
end$$;
```

이후 마이페이지 → 발행권 5 / 영구소장권 5 / AI 스냅·영상·가족 잠금해제 ✓
모두 표시되어야 한다.
