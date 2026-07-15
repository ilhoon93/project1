-- 061_social_proof_designs_and_conversion.sql
--
-- (1) 사회적 증거 데이터를 "디자인 사진"과 "리뷰 텍스트"로 분리한다.
--     기존 reviews(jsonb) 는 리뷰 텍스트(별점·문구) 전용으로 유지하고, 디자인
--     사진은 새 designs(jsonb) 컬럼에 담아 랜딩에서 각각 별도 마퀴로 흐르게 한다.
--
-- (2) "만들어본 고객의 N% 가 2주 내로 구매를 결정했어요" 문구/타일용 설정 컬럼.
--     N% 는 통계에서 자동으로 읽으므로 문구 템플릿·라벨·노출 여부만 저장.
--
-- (3) 위 N% 를 랜딩(anon)에서 읽을 공개 RPC — admin_invitation_stats 의
--     제작→결제 전환율 정의(미결제 & 최종수정 2주 미만 제외)와 동일. 정수 %만 반환.

-- ─────────────────────────────────────────────────────────────
alter table public.marketing_social_proof
  add column if not exists designs jsonb not null default '[]'::jsonb;

alter table public.marketing_social_proof
  add column if not exists purchase_stat_enabled boolean not null default true;

alter table public.marketing_social_proof
  add column if not exists purchase_stat_caption text not null
    default '만들어본 고객의 {pct}%가 2주 내로 구매를 결정했어요.';

alter table public.marketing_social_proof
  add column if not exists purchase_stat_label text not null
    default '2주 내 구매 결정';

-- ─────────────────────────────────────────────────────────────
create or replace function public.public_purchase_conversion_pct()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  with eligible as (
    select id from public.admin_stats_eligible_users() as t(id)
  ),
  all_inv as (
    select user_id, updated_at, (updated_at <> created_at) as was_made
    from public.invitations
    union all
    select user_id, updated_at, was_made
    from public.invitation_delete_archive
  ),
  made_users as (
    select a.user_id,
           bool_or(a.updated_at <= now() - interval '14 days') as has_matured
    from all_inv a
    where a.was_made and a.user_id in (select id from eligible)
    group by a.user_id
  ),
  made_users2 as (
    select m.user_id,
           m.has_matured,
           exists (
             select 1 from public.publish_credits_ledger l
              where l.user_id = m.user_id and l.reason = 'purchase'
           ) as has_purchase
    from made_users m
  ),
  agg as (
    select
      (count(*) filter (where has_purchase))::numeric as num,
      (count(*) filter (where has_purchase or has_matured))::numeric as den
    from made_users2
  )
  select case when den > 0 then round(num / den * 100)::int else 0 end
  from agg;
$$;

grant execute on function public.public_purchase_conversion_pct() to anon, authenticated;
