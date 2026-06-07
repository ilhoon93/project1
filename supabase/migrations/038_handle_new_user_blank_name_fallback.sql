-- ============================================================
-- 038_handle_new_user_blank_name_fallback
--
-- 배경: 네이버 로그인 동의 항목을 "이메일만 필수" 로 바꾸면 회원이름/별명이
-- 비어 있는 채로 가입되는 케이스가 생긴다. 기존 handle_new_user 트리거는
-- coalesce(name, preferred_username, email-local) 를 쓰는데, name 이 NULL 이
-- 아니라 빈 문자열('') 이면 coalesce 가 ''(빈 값) 을 유효값으로 보고 display_name
-- 을 빈 문자열로 굳혀 버린다.
--
-- 콜백 코드(route.ts)에서 빈 이름은 metadata 에 아예 넣지 않도록 고쳤지만,
-- DB 단에서도 nullif 로 빈 문자열을 NULL 취급해 어떤 가입 경로든 안전하게
-- 이메일 local-part 까지 폴백하도록 트리거를 보강한다.
--
-- ⚠️ 이 트리거는 auth.users INSERT 시에만 동작 → 기존 유저/프로필은 영향 없음.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      nullif(trim(new.raw_user_meta_data->>'preferred_username'), ''),
      nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
