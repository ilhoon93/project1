-- 064_review_event_submissions.sql
--
-- 포토리뷰 이벤트 참여 제출/동의 관리.
--   - 고객이 리뷰+아이디가 보이는 캡처본을 업로드하고, "리뷰·알림장 화면이 사례로
--     소개될 수 있음"에 동의(consent)해야 참여할 수 있다.
--   - 관리자가 확인(confirm)하면 영구소장권 1개가 적립되고 status 가 confirmed 로.
--
-- user_id 를 PK 로 두어 1인 1건. 재제출 시 이미지/상태를 갱신(단, confirmed 이후엔
-- 서버 액션에서 재제출을 막는다).

create table if not exists public.review_event_submissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  image_url text not null,
  consent boolean not null default true,
  -- 'submitted'(입력완료) | 'confirmed'(확인완료)
  status text not null default 'submitted',
  archive_credit_granted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null
);

comment on table public.review_event_submissions is
  '포토리뷰 이벤트 제출/동의. 관리자 확인 시 영구소장권 적립.';

-- updated_at 자동 갱신
create or replace function public.review_event_submissions_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists review_event_submissions_touch on public.review_event_submissions;
create trigger review_event_submissions_touch
  before update on public.review_event_submissions
  for each row execute function public.review_event_submissions_touch();

-- RLS: 본인 행만 읽기/쓰기. 관리자는 service role(admin client)로 접근.
alter table public.review_event_submissions enable row level security;

drop policy if exists review_event_self_select on public.review_event_submissions;
create policy review_event_self_select
  on public.review_event_submissions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists review_event_self_insert on public.review_event_submissions;
create policy review_event_self_insert
  on public.review_event_submissions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists review_event_self_update on public.review_event_submissions;
create policy review_event_self_update
  on public.review_event_submissions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
