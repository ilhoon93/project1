'use client';

import { useState, useTransition } from 'react';
import type { NoticeBarConfig } from '@/lib/marketing/notice-bar';
import { saveNoticeBarAction } from './actions';

const inputCls =
  'w-full rounded border border-[#E8DCC9] bg-white px-2.5 py-1.5 text-[13px] text-[#3D2E1F] focus:border-[#8B7355] focus:outline-none';
const labelCls = 'block text-[11px] font-medium text-[#8B7355]';

export function NoticeBarEditor({
  initialConfig,
}: {
  initialConfig: NoticeBarConfig;
}) {
  const [config, setConfig] = useState<NoticeBarConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const patch = (partial: Partial<NoticeBarConfig>) =>
    setConfig((c) => ({ ...c, ...partial }));

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await saveNoticeBarAction(config);
      setMsg(res.ok ? '저장되었습니다.' : `저장 실패: ${res.error ?? 'unknown'}`);
    });
  };

  const message = config.message.trim();

  return (
    <div className="flex flex-col gap-5">
      {/* 노출 여부 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-[#3D2E1F]">노출</div>
            <p className="mt-0.5 text-[11px] text-[#8B7355]">
              켜면 홈 상단에 공지 띠가 노출됩니다. (기본 꺼짐)
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            aria-label="공지바 노출 여부"
            onClick={() => patch({ enabled: !config.enabled })}
            className={`inline-flex h-6 w-11 shrink-0 items-center overflow-hidden rounded-full p-0.5 transition-colors ${
              config.enabled ? 'bg-[#8B7355]' : 'bg-[#D9CCB8]'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                config.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* 문구 · 링크 */}
      <section className="flex flex-col gap-3 rounded-md border border-[#E8DCC9] bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>공지 문구</span>
          <textarea
            className={`${inputCls} min-h-[64px] resize-y leading-relaxed`}
            rows={2}
            value={config.message}
            onChange={(e) => patch({ message: e.target.value })}
            placeholder="예: 포토리뷰 작성하고 영구소장 무료로 받아가세요!"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>링크 URL (선택)</span>
            <input
              className={inputCls}
              value={config.linkUrl}
              onChange={(e) => patch({ linkUrl: e.target.value })}
              placeholder="예: /mypage 또는 https://…"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>링크 버튼 라벨 (선택)</span>
            <input
              className={inputCls}
              value={config.linkLabel}
              onChange={(e) => patch({ linkLabel: e.target.value })}
              placeholder="예: 자세히 보기"
            />
          </label>
        </div>
      </section>

      {/* 미리보기 */}
      <section className="flex flex-col gap-2">
        <span className={labelCls}>미리보기</span>
        {message ? (
          <div className="relative overflow-hidden rounded-md bg-[var(--wd-coral)] text-[var(--wd-cream)]">
            <div className="flex items-center justify-center gap-2 px-9 py-2 text-center text-[12.5px] font-medium">
              <span className="break-keep">{message}</span>
              {config.linkUrl.trim() && (
                <span className="whitespace-nowrap rounded-full bg-[var(--wd-cream)]/20 px-2.5 py-0.5 text-[11.5px] font-semibold">
                  {config.linkLabel.trim() || '자세히 보기'} →
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-[#E8DCC9] p-3 text-[11px] text-[#B09B80]">
            문구를 입력하면 미리보기가 표시됩니다.
          </p>
        )}
        {!config.enabled && (
          <p className="text-[11px] text-[#B09B80]">
            현재 <strong>노출 꺼짐</strong> 상태라 실제 홈에는 보이지 않습니다.
          </p>
        )}
      </section>

      {/* 저장 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-[#3D2E1F] px-5 py-2 text-[13px] font-medium text-white disabled:opacity-60"
        >
          {pending ? '저장 중...' : '저장'}
        </button>
        {msg && (
          <span
            className={`text-[12px] ${msg.startsWith('저장 실패') ? 'text-red-600' : 'text-emerald-700'}`}
          >
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
