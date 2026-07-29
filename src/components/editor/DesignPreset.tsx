'use client';

import { useEditorStore } from '@/stores/editor';
import { DESIGN_PRESETS, type DesignPresetItem } from '@/lib/editor/design-presets';

/**
 * 메인디자인 빠른설정 — 표지 룩(색상·폰트·배경효과·표지 레이아웃)을 한 번에 고른다.
 *
 * 적용 시 theme(colorTheme/petalType/font)과 main.layout 만 바꾸고, 이름·사진·표지
 * 문구 등 사용자 데이터는 보존한다. 세부 조정은 아래 "메인/테마" 편집에서 계속 가능.
 */
export function DesignPreset() {
  // 현재 룩(색/꽃/폰트/레이아웃)을 문자열로 구독 → 바뀔 때만 리렌더(활성 표시용).
  const currentKey = useEditorStore((s) => {
    const c = s.content;
    if (!c) return null;
    return [c.theme.colorTheme, c.theme.petalType, c.theme.font, c.main.layout].join('|');
  });
  if (currentKey === null) return null;

  const keyOf = (p: DesignPresetItem) =>
    [p.colorTheme, p.petalType, p.font, p.layout].join('|');

  const apply = (p: DesignPresetItem) => {
    const state = useEditorStore.getState();
    const c = state.content;
    if (!c) return;
    state.patchSection('theme', {
      ...c.theme,
      colorTheme: p.colorTheme,
      petalType: p.petalType,
      font: p.font,
    });
    state.patchSection('main', { ...c.main, layout: p.layout });
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-foreground">추천 디자인</h3>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
        표지 색상·폰트·배경효과·형태를 한 번에 골라요. 아래 &ldquo;메인&rdquo;·&ldquo;테마&rdquo;에서
        세부 조정할 수 있어요.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DESIGN_PRESETS.map((p) => {
          const active = keyOf(p) === currentKey;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => apply(p)}
              aria-pressed={active}
              className={`flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors ${
                active ? 'border-primary bg-primary/10' : 'border-input hover:bg-muted/50'
              }`}
            >
              <span className="text-xs font-semibold">{p.name}</span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {p.layoutLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
