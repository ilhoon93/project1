-- 063_invitation_showcase_consent.sql
--
-- 고객이 자신의 알림장 메인 디자인을 홈페이지 디자인 갤러리에 "익명(얼굴 스티커 +
-- 이니셜)"으로 노출하는 데 동의했는지 저장. 관리자 showcase 도구는 이 값이 true 인
-- (그리고 메인 사진이 있는) 알림장만 후보로 보여준다.
--
-- 기본 false — 명시적 옵트인만 노출 대상.

alter table public.invitations
  add column if not exists showcase_consent boolean not null default false;

comment on column public.invitations.showcase_consent is
  '홈페이지 디자인 갤러리 익명 노출 동의(옵트인). 관리자 showcase 후보 필터.';
