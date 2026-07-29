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
  // 현재 룩(색/꽃/폰트/레이아웃 + 액자 variant)을 문자열로 구독 → 바뀔 때만
  // 리렌더(활성 표시용). 액자 프리셋은 variant 로 구분되므로 함께 넣는다.
  const currentKey = useEditorStore((s) => {
    const c = s.content;
    if (!c) return null;
    const frameVariant = c.main.layout === 'frame' ? (c.main.frameDesign?.variant ?? '') : '';
    return [c.theme.colorTheme, c.theme.petalType, c.theme.font, c.main.layout, frameVariant].join('|');
  });
  if (currentKey === null) return null;

  const keyOf = (p: DesignPresetItem) =>
    [p.colorTheme, p.petalType, p.font, p.layout, p.frameVariant ?? ''].join('|');

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
    // 액자 프리셋은 표지 형태(variant)까지 맞춰줘야 예시와 같은 모양이 된다.
    // (지정 안 하면 스키마 기본값 polaroid 로 남아 모든 액자가 폴라로이드로 보임.)
    const nextMain = p.frameVariant
      ? { ...c.main, layout: p.layout, frameDesign: { ...c.main.frameDesign, variant: p.frameVariant } }
      : { ...c.main, layout: p.layout };
    state.patchSection('main', nextMain);
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-foreground">추천 디자인</h3>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
        표지 색상·폰트·형태를 한 번에 골라요.
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
