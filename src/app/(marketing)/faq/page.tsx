import type { Metadata } from 'next';
import { FaqClient } from './FaqClient';

export const metadata: Metadata = {
  title: '자주 묻는 질문 (FAQ) — 우리다운',
  description: '알림장·AI 웨딩스냅 유효기간·영구소장·결제/환불 등 자주 묻는 질문',
};

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
        FAQ
      </div>
      <h1 className="mt-2 text-[24px] font-medium tracking-tight text-[var(--wd-ink)] sm:text-[28px]">
        자주 묻는 질문
      </h1>
      <p className="mt-2 text-[14px] leading-[1.75] text-[var(--wd-mute)]">
        알림장과 AI 웨딩스냅으로 나눠 자주 묻는 내용을 모았어요.
      </p>

      <FaqClient />
    </main>
  );
}
