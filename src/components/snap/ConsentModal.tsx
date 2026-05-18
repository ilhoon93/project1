'use client';

/**
 * AI 웨딩스냅 동의 모달.
 *
 * 첫 사용 또는 약관 버전 업데이트 시 SnapGenerator 진입 직전에 표시.
 * 필수 2개 + 선택 1개 동의 체크를 받아 /api/snap/consent 에 POST.
 *
 * 사용 패턴:
 *   const [needsConsent, setNeedsConsent] = useState<boolean | null>(null);
 *   useEffect(() => {
 *     fetch('/api/snap/consent').then((r) => r.json()).then((d) => {
 *       setNeedsConsent(!d.hasConsent);
 *     });
 *   }, []);
 *   if (needsConsent) return <ConsentModal onAccept={() => setNeedsConsent(false)} />
 */

import { useState } from 'react';
import Link from 'next/link';

interface Props {
  onAccept: () => void;
  onCancel?: () => void;
}

export function ConsentModal({ onAccept, onCancel }: Props) {
  const [personalInfo, setPersonalInfo] = useState(false);
  const [aiGeneration, setAiGeneration] = useState(false);
  const [externalShare, setExternalShare] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = personalInfo && aiGeneration && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const scopes: Array<'personal_info' | 'ai_generation' | 'external_share'> = [
        'personal_info',
        'ai_generation',
      ];
      if (externalShare) scopes.push('external_share');
      const res = await fetch('/api/snap/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scopes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? '동의 저장에 실패했습니다.');
      }
      onAccept();
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-t-lg bg-white shadow-xl sm:rounded-lg">
        <div className="border-b border-[#E8DCC9] px-5 py-4">
          <h2 className="text-base font-semibold text-[#3D2E1F]">
            AI 웨딩스냅 사용 동의
          </h2>
          <p className="mt-1 text-[11px] text-[#8B7355]">
            얼굴 정보와 AI 합성 처리에 대한 동의가 필요합니다.
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 text-[12px] text-[#5C4633]">
          <ConsentItem
            label="(필수) 개인정보 처리"
            checked={personalInfo}
            onChange={setPersonalInfo}
          >
            업로드한 사진(얼굴 정보 포함) 의 저장·분석·처리에 동의합니다.
            합성 결과 생성 후 원본 사진은 30일간 보관 후 삭제됩니다.{' '}
            <Link href="/legal/snap-privacy" target="_blank" className="text-[#3D2E1F] underline">
              개인정보 처리방침 보기
            </Link>
          </ConsentItem>

          <ConsentItem
            label="(필수) AI 합성 / 제3자 처리 위탁"
            checked={aiGeneration}
            onChange={setAiGeneration}
          >
            업로드 사진이 AI 합성을 위해 fal.ai(미국) 에 처리 위탁됨에 동의합니다.
            fal.ai 는 본 서비스 외 용도로 데이터를 사용하지 않습니다.{' '}
            <Link href="/legal/snap-terms" target="_blank" className="text-[#3D2E1F] underline">
              이용약관 보기
            </Link>
          </ConsentItem>

          <ConsentItem
            label="(선택) 외부 채널 노출"
            checked={externalShare}
            onChange={setExternalShare}
          >
            식별 정보를 제거한 결과 이미지가 회사 공식 SNS, 마켓플레이스 등
            외부 채널 마케팅에 활용되는 것에 동의합니다. 언제든 철회 가능합니다.
          </ConsentItem>

          {error && (
            <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-[#E8DCC9] px-5 py-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-md border border-[#E8DCC9] bg-white px-3 py-2 text-xs font-medium text-[#5C4633] hover:bg-[#FAF7F2]"
            >
              취소
            </button>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="flex-1 rounded-md bg-[#3D2E1F] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {submitting ? '저장 중...' : '동의하고 시작'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsentItem({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 flex cursor-pointer items-start gap-2 rounded border border-[#E8DCC9] bg-white p-3 transition-colors hover:border-[#8B7355]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <div className="flex-1">
        <span className="block text-[12px] font-medium text-[#3D2E1F]">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-[#5C4633]">
          {children}
        </span>
      </div>
    </label>
  );
}
