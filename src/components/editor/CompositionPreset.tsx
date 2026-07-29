'use client';

import { useEditorStore } from '@/stores/editor';

/**
 * 구성 빠른 설정 — 표시할 슬라이드 묶음을 한 번에 고른다(간편 / 중간 / 상세).
 *
 * 각 프리셋은 토글 가능한 섹션의 enabled 플래그만 세팅한다. 내용(사진·계좌·글)은
 * 지우지 않고 노출 여부만 바꾸므로, 다른 구성으로 갔다가 돌아와도 그대로 복구된다.
 * main / closing 은 항상 노출되므로 프리셋 대상이 아니다.
 */

// enabled 플래그를 가진 토글 섹션(= InvitationContent 상 객체 키).
const TOGGLE_KEYS = [
  'basic',
  'story',
  'gallery',
  'video',
  'quiz',
  'vote',
  'guestbook',
  'account',
] as const;
type ToggleKey = (typeof TOGGLE_KEYS)[number];

interface Preset {
  id: string;
  name: string;
  desc: string;
  on: readonly ToggleKey[];
}

const PRESETS: readonly Preset[] = [
  { id: 'simple', name: '간편', desc: '기본정보 · 계좌', on: ['basic', 'account'] },
  {
    id: 'middle',
    name: '중간',
    desc: '간편 + 갤러리 · 방명록',
    on: ['basic', 'gallery', 'guestbook', 'account'],
  },
  { id: 'detail', name: '상세', desc: '모든 슬라이드', on: [...TOGGLE_KEYS] },
];

const maskOf = (on: readonly ToggleKey[]) =>
  TOGGLE_KEYS.map((k) => (on.includes(k) ? '1' : '0')).join('');

export function CompositionPreset() {
  // 현재 enabled 조합을 문자열 마스크로 구독 → 조합이 바뀔 때만 리렌더(활성 표시용).
  const enabledMask = useEditorStore((s) => {
    const c = s.content;
    if (!c) return null;
    return TOGGLE_KEYS.map((k) =>
      (c[k] as { enabled?: boolean }).enabled ? '1' : '0',
    ).join('');
  });
  if (enabledMask === null) return null;

  const activeId = PRESETS.find((p) => maskOf(p.on) === enabledMask)?.id ?? null;

  const apply = (preset: Preset) => {
    const state = useEditorStore.getState();
    const c = state.content;
    if (!c) return;
    // patchSection 은 제네릭이라 루프에서 키별 타입이 갈린다 → 느슨한 시그니처로 캐스팅.
    const patch = state.patchSection as unknown as (k: ToggleKey, v: unknown) => void;
    for (const k of TOGGLE_KEYS) {
      const section = c[k] as { enabled?: boolean } & Record<string, unknown>;
      const next = preset.on.includes(k);
      if (section.enabled !== next) patch(k, { ...section, enabled: next });
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold">구성 빠른 설정</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          표시할 슬라이드를 한 번에 골라요. 내용은 지워지지 않고 노출 여부만 바뀌며,
          아래에서 개별로 다시 켜고 끌 수 있어요.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const active = activeId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => apply(p)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-center transition-colors ${
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-input hover:bg-muted/50'
                }`}
              >
                <span className="text-xs font-semibold">{p.name}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {p.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
