'use client';

import { useEditorStore } from '@/stores/editor';
import {
  SECTION_HEADER_DEFAULTS,
  type SectionHeaderKey,
  type SectionHeaderOverride,
} from '@/types/invitation';

/**
 * 슬라이드 상단 헤더(영문 라벨 + 한글 제목) 편집 블록.
 *
 * 각 섹션 에디터 안에 넣어, 해당 슬라이드의 중앙 상단 영문/한글 제목 문구를
 * 수정하거나 각각 표시/숨김할 수 있게 한다. 비워두면 기본값으로 표시된다.
 * 저장은 content.sectionHeaders[key] override 로만 이뤄진다.
 */
export function SectionHeaderFields({
  sectionKey,
}: {
  sectionKey: SectionHeaderKey;
}) {
  const content = useEditorStore((s) => s.content);
  const patch = useEditorStore((s) => s.patchSection);
  if (!content) return null;

  // 예전 draft(persist)에는 sectionHeaders 가 없을 수 있어 빈 객체로 폴백.
  const headers = content.sectionHeaders ?? {};
  const cur = (headers[sectionKey] ?? {}) as Partial<SectionHeaderOverride>;
  const def = SECTION_HEADER_DEFAULTS[sectionKey];
  const en = cur.en ?? '';
  const ko = cur.ko ?? '';
  const showEn = cur.showEn ?? true;
  const showKo = cur.showKo ?? true;

  const update = (partial: Partial<SectionHeaderOverride>) => {
    const next: SectionHeaderOverride = { en, ko, showEn, showKo, ...partial };
    patch('sectionHeaders', { ...headers, [sectionKey]: next });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-input bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">상단 제목</span>
        <span className="text-xs text-muted-foreground">영문 · 한글 각각 표시/숨김</span>
      </div>

      <HeaderRow
        caption="영문"
        value={en}
        placeholder={def.en}
        show={showEn}
        onToggle={() => update({ showEn: !showEn })}
        onChange={(v) => update({ en: v })}
      />
      <HeaderRow
        caption="한글"
        value={ko}
        placeholder={def.ko}
        show={showKo}
        onToggle={() => update({ showKo: !showKo })}
        onChange={(v) => update({ ko: v })}
      />
    </div>
  );
}

function HeaderRow({
  caption,
  value,
  placeholder,
  show,
  onToggle,
  onChange,
}: {
  caption: string;
  value: string;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">
        {caption}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={!show}
        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-40"
      />
      <button
        type="button"
        role="switch"
        aria-checked={show}
        aria-label={`${caption} 제목 표시`}
        onClick={onToggle}
        className={`inline-flex h-6 w-11 shrink-0 items-center overflow-hidden rounded-full p-0.5 transition-colors ${
          show ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            show ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
