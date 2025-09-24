-- onboarding_prompt_logs 테이블 생성 (온보딩 프롬프트 전용 변경 이력)
create table if not exists public.onboarding_prompt_logs (
  id bigserial primary key,
  content text not null,
  changed_by text null,
  changed_at timestamptz not null default now()
);

comment on table public.onboarding_prompt_logs is '온보딩 시스템 프롬프트 전용 변경 이력 저장 테이블';
comment on column public.onboarding_prompt_logs.content is '변경 후 저장된 온보딩 프롬프트 내용 스냅샷';
comment on column public.onboarding_prompt_logs.changed_by is '수정자 식별자(관리자 userId)';
comment on column public.onboarding_prompt_logs.changed_at is '변경 시각';

-- RLS (옵션): 서비스 역할에서만 접근하도록 정책을 두는 경우 별도 정책을 추가하세요.

