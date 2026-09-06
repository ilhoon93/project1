'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor';
import type { EditorSampleDesign } from '@/lib/editor/design-presets';
import { InvitationPreview } from '@/components/marketing/InvitationPreview';

/**
 * 추천 디자인 — 운영자가 admin "알림장 샘플 설정"에 등록한 디자인 미리보기 샘플을
 * 그대로 골라 적용한다(색·폰트·배경효과·표지 디자인 전부 샘플과 동일).
 *
 * 데이터 정책:
 *   - 표지 디자인(테마 + main 의 레이아웃/디자인)은 항상 샘플 값으로 교체한다.
 *   - 아직 편집 안 한 "새 알림장"(isFresh)에서는 분위기를 바로 볼 수 있게 샘플의
 *     메인사진·인사말·이름·날짜도 함께 로딩한다(사용자 교체 전제 — 사진은 샘플).
 *   - 사용자가 자기 데이터를 입력한 뒤에는 디자인만 바뀌고 데이터는 보존된다.
 *     (직전에 로딩한 샘플 값과 현재 값이 같을 때만 = 아직 안 건드렸을 때만 재로딩.)
 */

/** 샘플 사진(카탈로그) 식별용 — 발행 전 교체 안내 판단에 사용. */
export const SAMPLE_PHOTO_MARK = '/wedding-snap/catalog/';

const sigOf = (
  colorTheme: string,
  petalType: string,
  font: string,
  main: EditorSampleDesign['main'],
) =>
  [
    colorTheme,
    petalType,
    font,
    main.layout,
    main.layout === 'frame' ? (main.frameDesign?.variant ?? '') : '',
  ].join('|');

export function DesignPreset({
  designs,
  isFresh,
}: {
  designs: EditorSampleDesign[];
  isFresh: boolean;
}) {
  // 현재 룩을 문자열로 구독 → 바뀔 때만 리렌더(활성 표시용).
  const currentKey = useEditorStore((s) => {
    const c = s.content;
    if (!c) return null;
    return sigOf(c.theme.colorTheme, c.theme.petalType, c.theme.font, c.main);
  });
  const usesSamplePhoto = useEditorStore(
    (s) => !!s.content?.main.heroImage?.includes(SAMPLE_PHOTO_MARK),
  );

  // 사진 있는 / 없는 두 그룹 — 관리자 샘플 설정 분류(hasPhoto)와 동일.
  const photo = useMemo(() => designs.filter((d) => d.hasPhoto), [designs]);
  const nophoto = useMemo(() => designs.filter((d) => !d.hasPhoto), [designs]);
  // 기본값은 사진 있는 디자인. 한쪽 그룹이 비어 있으면 있는 쪽을 기본으로.
  const [view, setView] = useState<'photo' | 'nophoto'>(
    photo.length > 0 ? 'photo' : 'nophoto',
  );

  if (currentKey === null) return null;

  // 샘플 데이터를 지금 로딩(교체)해도 되는지 — 새 알림장이고, 현재 표지 데이터가
  // "비어 있거나 어떤 샘플과 정확히 일치"할 때만 true. 사용자가 직접 넣은 사진·글은
  // 어떤 샘플과도 일치하지 않으므로 보존되고, 직전에 자동 로딩된 샘플 데이터는 어떤
  // 샘플과 일치하므로 다음 샘플 클릭 시 그 샘플 값으로 교체된다(이전 샘플이 남지 않음).
  // ref/스냅샷에 의존하지 않아 리마운트에도 안전하다.
  const canLoadSampleData = (): boolean => {
    if (!isFresh) return false;
    const { content: c, meta } = useEditorStore.getState();
    if (!c || !meta) return false;
    const isEmpty =
      !c.main.heroImage &&
      !c.main.greeting &&
      !meta.groomName &&
      !meta.brideName &&
      !meta.weddingDate;
    if (isEmpty) return true;
    const hero = c.main.heroImage ?? null;
    return designs.some(
      (d) =>
        (d.heroImageUrl ?? null) === hero &&
        d.main.greeting === c.main.greeting &&
        d.groomName === meta.groomName &&
        d.brideName === meta.brideName &&
        (d.weddingDate ?? null) === (meta.weddingDate ?? null),
    );
  };

  const apply = (d: EditorSampleDesign) => {
    const state = useEditorStore.getState();
    const c = state.content;
    if (!c) return;

    // 1) 테마(색/꽃/폰트) — 디자인. bgm 등 사용자 설정은 보존.
    state.patchSection('theme', {
      ...c.theme,
      colorTheme: d.colorTheme,
      petalType: d.petalType,
      font: d.font,
    });

    // 2) 표지 디자인 필드만 샘플로 교체(사진·인사말 등 데이터는 아래에서 분기).
    const designMain = {
      layout: d.main.layout,
      posterDesign: d.main.posterDesign,
      illustrationDesign: d.main.illustrationDesign,
      textDesign: d.main.textDesign,
      frameDesign: d.main.frameDesign,
    };

    if (canLoadSampleData()) {
      // 비었거나 이전 샘플 그대로 → 이 샘플의 데이터(사진·인사말·이름·날짜)로 교체.
      state.patchSection('main', {
        ...c.main,
        ...designMain,
        heroImage: d.heroImageUrl,
        greeting: d.main.greeting,
      });
      state.setMeta({
        groomName: d.groomName,
        brideName: d.brideName,
        weddingDate: d.weddingDate,
      });
    } else {
      // 사용자가 입력한 데이터 보존 — 디자인만 교체.
      state.patchSection('main', { ...c.main, ...designMain });
    }
  };

  // 두 그룹 모두 있을 때만 탭 노출.
  const showTabs = photo.length > 0 && nophoto.length > 0;
  const tabCls = (on: boolean) =>
    `flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
      on ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
    }`;

  const renderCard = (d: EditorSampleDesign) => {
    const active = sigOf(d.colorTheme, d.petalType, d.font, d.main) === currentKey;
    return (
      <button
        key={d.id}
        type="button"
        onClick={() => apply(d)}
        aria-pressed={active}
        className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-colors ${
          active ? 'border-primary ring-1 ring-primary' : 'border-input hover:border-primary/50'
        }`}
      >
        {/* 실제 표지 미리보기(정적) 썸네일 — 표지 안엔 번호를 얹지 않는다. */}
        <div className="wd-static-preview relative aspect-[1/2] w-full overflow-hidden bg-[#15110E]">
          <InvitationPreview design={d.preview} cover staticPreview />
          {active && (
            <span className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
              선택됨
            </span>
          )}
        </div>
        <div className="px-2 py-1.5">
          <span className="flex items-center gap-1">
            {d.number != null && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-semibold leading-none text-background">
                {d.number}
              </span>
            )}
            <span className="truncate text-[11px] font-semibold">{d.name}</span>
          </span>
          <span className="block truncate text-[10px] leading-tight text-muted-foreground">
            {d.layoutLabel}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-foreground">추천 디자인</h3>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
        표지 색상·폰트·형태를 한 번에 골라요.
        {isFresh && ' 새 알림장이라 사진·인사말도 샘플로 채워 분위기를 보여드려요.'}
      </p>

      {showTabs && (
        <div className="mt-2 flex gap-1.5">
          <button type="button" onClick={() => setView('photo')} className={tabCls(view === 'photo')}>
            사진 있는 디자인
          </button>
          <button type="button" onClick={() => setView('nophoto')} className={tabCls(view === 'nophoto')}>
            사진 없는 디자인
          </button>
        </div>
      )}

      {designs.length === 0 ? (
        <p className="mt-2 text-[11px] leading-tight text-muted-foreground">
          등록된 디자인이 없습니다.
        </p>
      ) : (
        // 두 그룹을 모두 마운트해 두고 탭에 따라 hidden 으로만 전환한다 —
        // 탭 전환 때 썸네일이 리마운트되며 scale=0(검은 프레임)부터 다시
        // 페이드인하는 "잠깐 검은 화면" 깜빡임을 없앤다(한 번만 그려짐).
        <>
          {photo.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2.5" hidden={view !== 'photo'}>
              {photo.map(renderCard)}
            </div>
          )}
          {nophoto.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2.5" hidden={view !== 'nophoto'}>
              {nophoto.map(renderCard)}
            </div>
          )}
        </>
      )}
      {usesSamplePhoto && (
        <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] leading-tight text-amber-900 ring-1 ring-amber-200">
          지금 메인 사진은 <strong>샘플 사진</strong>이에요. 아래 &ldquo;메인 화면&rdquo;에서 내
          사진으로 바꿔 발행해주세요.
        </p>
      )}
    </div>
  );
}
