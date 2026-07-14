'use client';

import { useRef, useState, useTransition } from 'react';
import { nanoid } from '@/lib/utils/nanoid';
import type {
  SocialProofConfig,
  SocialProofReview,
} from '@/lib/marketing/social-proof';
import { saveSocialProofAction, uploadReviewImage } from './actions';

const inputCls =
  'w-full rounded border border-[#E8DCC9] bg-white px-2.5 py-1.5 text-[13px] text-[#3D2E1F] focus:border-[#8B7355] focus:outline-none';
const labelCls = 'block text-[11px] font-medium text-[#8B7355]';

export function SocialProofEditor({
  initialConfig,
}: {
  initialConfig: SocialProofConfig;
}) {
  const [config, setConfig] = useState<SocialProofConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const patch = (partial: Partial<SocialProofConfig>) =>
    setConfig((c) => ({ ...c, ...partial }));

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await saveSocialProofAction(config);
      setMsg(res.ok ? '저장되었습니다.' : `저장 실패: ${res.error ?? 'unknown'}`);
    });
  };

  const addReview = (review: SocialProofReview) =>
    patch({ reviews: [...config.reviews, review] });

  const updateReview = (id: string, partial: Partial<SocialProofReview>) =>
    patch({
      reviews: config.reviews.map((r) => (r.id === id ? { ...r, ...partial } : r)),
    });

  const removeReview = (id: string) =>
    patch({ reviews: config.reviews.filter((r) => r.id !== id) });

  const moveReview = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= config.reviews.length) return;
    const list = [...config.reviews];
    [list[index], list[j]] = [list[j], list[index]];
    patch({ reviews: list });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── 노출 여부 ─────────────────────────────── */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-[#3D2E1F]">메인 노출</div>
            <p className="mt-0.5 text-[11px] text-[#8B7355]">
              켜면 메인 알림장 소개 섹션 하단에 바로 노출됩니다.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            aria-label="메인 노출 여부"
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

      {/* ── 섹션 문구 ─────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-[13px] font-semibold text-[#3D2E1F]">섹션 문구</h2>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>제목</span>
          <input
            className={inputCls}
            value={config.heading}
            onChange={(e) => patch({ heading: e.target.value })}
            placeholder="예: 이미 우리다운으로 소식을 전한 커플들"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>부제</span>
          <input
            className={inputCls}
            value={config.subheading}
            onChange={(e) => patch({ subheading: e.target.value })}
            placeholder="예: 실제 사용자들의 후기예요."
          />
        </label>
      </section>

      {/* ── 커플 수 ─────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-[13px] font-semibold text-[#3D2E1F]">커플 수</h2>
        <p className="rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-2.5 text-[11px] leading-relaxed text-[#8B7355]">
          커플 수는 <strong className="text-[#3D2E1F]">발행된 알림장 건수를 10단위로
          올림</strong>해 자동 계산됩니다(예: 47건 → 50). 여기서는 단위와 보조 문구만
          설정합니다.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>단위</span>
            <input
              className={inputCls}
              value={config.coupleCountSuffix}
              onChange={(e) => patch({ coupleCountSuffix: e.target.value })}
              placeholder="쌍"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>보조 문구</span>
            <input
              className={inputCls}
              value={config.coupleCountCaption}
              onChange={(e) => patch({ coupleCountCaption: e.target.value })}
              placeholder="예: 누적 알림장 제작"
            />
          </label>
        </div>
        <p className="text-[11px] text-[#8B7355]">
          미리보기:{' '}
          <span className="font-semibold text-[#3D2E1F]">
            (발행 건수){config.coupleCountSuffix}
          </span>{' '}
          {config.coupleCountCaption && (
            <span className="text-[#8B7355]">· {config.coupleCountCaption}</span>
          )}
        </p>
      </section>

      {/* ── 평균 별점 ─────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-[13px] font-semibold text-[#3D2E1F]">평균 별점</h2>
        <p className="text-[11px] text-[#8B7355]">
          사회적 증거에 &lsquo;X / 5&rsquo; 로 노출됩니다. 0 으로 두면 평점 타일이 숨겨집니다.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            className={`${inputCls} w-24`}
            value={config.averageRating}
            onChange={(e) =>
              patch({
                averageRating: Math.min(5, Math.max(0, Number(e.target.value) || 0)),
              })
            }
          />
          <span className="text-[13px] font-semibold text-[#3D2E1F]">
            {config.averageRating.toFixed(1)} / 5
          </span>
          <span className="text-[16px]" aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                style={{
                  color:
                    n <= Math.round(config.averageRating)
                      ? '#B5614F'
                      : 'rgba(61,46,31,0.22)',
                }}
              >
                ★
              </span>
            ))}
          </span>
        </div>
      </section>

      {/* ── 리뷰 이미지 ─────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-md border border-[#E8DCC9] bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[#3D2E1F]">
            리뷰 이미지 ({config.reviews.length})
          </h2>
        </div>

        {config.reviews.length === 0 && (
          <p className="text-[11px] text-[#8B7355]">
            아직 등록된 리뷰 이미지가 없습니다. 아래에서 추가해주세요.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {config.reviews.map((review, i) => (
            <li
              key={review.id}
              className="flex gap-3 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-3"
            >
              <ReviewThumb
                url={review.imageUrl}
                onUploaded={(url) => updateReview(review.id, { imageUrl: url })}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>별점</span>
                  <RatingPicker
                    value={review.rating}
                    onChange={(rating) => updateReview(review.id, { rating })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>리뷰 문구</span>
                  <textarea
                    className={`${inputCls} min-h-[72px] resize-y leading-relaxed`}
                    rows={3}
                    value={review.caption}
                    onChange={(e) =>
                      updateReview(review.id, { caption: e.target.value })
                    }
                    placeholder={'예: 하객들이 신선하다고 칭찬 많이 받았어요!\n제작도 정말 간편했습니다 :)'}
                  />
                </label>
                <div className="mt-auto flex items-center gap-1.5">
                  <SmallBtn disabled={i === 0} onClick={() => moveReview(i, -1)}>
                    ↑
                  </SmallBtn>
                  <SmallBtn
                    disabled={i === config.reviews.length - 1}
                    onClick={() => moveReview(i, 1)}
                  >
                    ↓
                  </SmallBtn>
                  <button
                    type="button"
                    onClick={() => removeReview(review.id)}
                    className="ml-1 text-[11px] text-red-600 hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() =>
            addReview({ id: nanoid(10), imageUrl: '', caption: '', rating: 5 })
          }
          className="self-start rounded border border-[#8B7355] px-3 py-1.5 text-[12px] font-medium text-[#8B7355] transition-colors hover:bg-[#8B7355] hover:text-white"
        >
          + 리뷰 추가
        </button>
      </section>

      {/* ── 저장 ─────────────────────────────── */}
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-[#E8DCC9] bg-[#FDFBF7]/90 py-3 backdrop-blur">
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

/** 별점 선택기 — 1~5 클릭. 같은 별을 다시 누르면 0(별점 없음)으로 토글. */
function RatingPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n}점`}
          onClick={() => onChange(value === n ? 0 : n)}
          className="text-[18px] leading-none"
          style={{ color: n <= value ? '#B5614F' : 'rgba(61,46,31,0.22)' }}
        >
          ★
        </button>
      ))}
      <span className="ml-1 text-[11px] text-[#8B7355]">
        {value > 0 ? `${value} / 5` : '별점 없음'}
      </span>
    </div>
  );
}

function SmallBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded border border-[#E8DCC9] bg-white text-[12px] text-[#5C4633] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** 리뷰 썸네일 + 업로드 버튼. 업로드 성공 시 부모에 public URL 전달. */
function ReviewThumb({
  url,
  onUploaded,
}: {
  url: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadReviewImage(fd);
      if (res.ok) onUploaded(res.url);
      else setErr(res.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-24 w-[72px] flex-shrink-0 overflow-hidden rounded border border-[#E8DCC9] bg-white">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[10px] text-[#B09B80]">
            이미지 없음
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded border border-[#E8DCC9] bg-white px-2 py-1 text-[10.5px] text-[#5C4633] disabled:opacity-50"
      >
        {busy ? '업로드…' : url ? '변경' : '업로드'}
      </button>
      {err && <span className="text-[10px] text-red-600">{err}</span>}
    </div>
  );
}
