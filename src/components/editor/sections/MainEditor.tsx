'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  ILLUSTRATION_VARIANTS,
  FRAME_VARIANTS,
  TEXT_VARIANTS,
  PosterDesignSchema,
  IllustrationDesignSchema,
  TextDesignSchema,
  FrameDesignSchema,
  type PosterDesign,
  type IllustrationDesign,
  type IllustrationVariant,
  type TextDesign,
  type TextVariant,
  type FrameDesign,
  type FrameVariant,
} from '@/types/invitation';
import { useEditorStore } from '@/stores/editor';
import {
  TITLE_FONT_KEYS_EN,
  TITLE_FONT_KEYS_KO,
  TITLE_FONT_OPTIONS,
  TITLE_TEXT_PRESETS,
  DEFAULT_TITLE_FONT_KO,
  DEFAULT_TITLE_FONT_EN,
  isKoreanTitleText,
  type TitleFontKey,
} from '@/lib/theme';
import { SectionEditor } from '../SectionEditor';
import { PresetTextArea } from '../PresetTextArea';
import { MAIN_GREETING_PRESETS } from '@/lib/presets';
import { ImageUploader } from '../ImageUploader';

// picker 에는 4가지 상위 레이아웃만 노출한다. 'polaroid' 는 구버전 데이터
// 호환용으로 enum 엔 남아 있지만 picker 에는 보이지 않고, 내부적으로 frame 과
// 동일한 분기를 탄다 (variant 는 frameDesign.variant 로 별도 선택).
const LAYOUT_PICKER_KEYS = ['poster', 'frame', 'illustration', 'text'] as const;
type LayoutPickerKey = (typeof LAYOUT_PICKER_KEYS)[number];

const LAYOUT_LABELS: Record<LayoutPickerKey, { name: string; hint: string }> = {
  poster: { name: '포스터', hint: '풀이미지 배경' },
  frame: { name: '액자프레임', hint: '폴라로이드 · 하트 · 스크린' },
  illustration: { name: '일러스트', hint: '신랑신부 그림' },
  text: { name: '텍스트', hint: '이미지 없이' },
};

// 액자프레임 분기 — 'frame' 또는 구버전 'polaroid' 둘 다 같은 컨트롤로 처리.
function isFrameLayout(layout: string): boolean {
  return layout === 'frame' || layout === 'polaroid';
}

// "이미지 표시 방법" 옵션은 코드는 살려두되 일단 UI 에서만 숨김.
// 데이터/렌더링 경로(MainSlide 의 imageFit/imagePosition)는 그대로 동작하므로
// 이 플래그를 true 로 바꾸면 즉시 다시 노출된다.
const SHOW_IMAGE_FIT_OPTION = false;

// 결혼 청첩장에서 자주 쓰이는 색상 — 활용 빈도 순서로 앞쪽에 배치.
// 흰/검정(고대비) → 따뜻한 세피아·골드 → 짙은 액센트(네이비·버건디·세이지)
// → 연한 톤(블러쉬·로즈·아이보리) 순.
const TITLE_COLOR_PRESETS = [
  '#FFFFFF', // 화이트
  '#000000', // 블랙
  '#3D2E1F', // 다크 세피아
  '#6B4423', // 브라운
  '#C9A66B', // 웜 골드
  '#1A2238', // 네이비
  '#5C2A2E', // 버건디
  '#2D4A33', // 세이지
  '#8B7355', // 모카
  '#C9748E', // 더스티 로즈
  '#E8A0A0', // 블러쉬 핑크
  '#F8F1E5', // 아이보리
];

export function MainEditor() {
  const main = useEditorStore((s) => s.content?.main);
  const invitationId = useEditorStore((s) => s.invitationId);
  const patch = useEditorStore((s) => s.patchSection);
  if (!main || !invitationId) return null;

  const layout = main.layout ?? 'poster';
  const showImagePicker = layout !== 'text' && layout !== 'illustration';
  const isPoster = layout === 'poster';
  const isIllustration = layout === 'illustration';
  const isText = layout === 'text';
  const isFrame = isFrameLayout(layout);
  const design = main.posterDesign;
  const illust = main.illustrationDesign;
  const text = main.textDesign;
  const frame = main.frameDesign;

  const patchDesign = (next: PosterDesign) => patch('main', { ...main, posterDesign: next });
  const patchIllust = (next: IllustrationDesign) =>
    patch('main', { ...main, illustrationDesign: next });
  const patchText = (next: TextDesign) => patch('main', { ...main, textDesign: next });
  const patchFrame = (next: FrameDesign) => patch('main', { ...main, frameDesign: next });

  return (
    <SectionEditor title="메인 화면" description="첫 슬라이드의 레이아웃과 인사말">
      <div className="flex flex-col gap-4">
        {/* 레이아웃 선택 + 메인 사진 미리보기 — 같은 행에 좌(레이아웃 버튼) + 우(미리보기) 배치.
            미리보기 컨테이너는 레이아웃에 상관없이 동일 사이즈를 유지 (w-32 + aspect-[9/16]). */}
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-start sm:gap-4">
          <div className="min-w-0 flex-1">
            <span className="font-medium text-foreground">레이아웃</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {LAYOUT_PICKER_KEYS.map((key) => {
                const selected = key === 'frame' ? isFrameLayout(layout) : layout === key;
                const meta = LAYOUT_LABELS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => patch('main', { ...main, layout: key })}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-0.5 rounded-md border px-1.5 py-1.5 text-[11px] leading-tight transition-colors ${
                      selected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-input bg-background text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="font-medium">{meta.name}</span>
                    <span className={`text-[10px] ${selected ? 'opacity-80' : 'text-muted-foreground'}`}>
                      {meta.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {showImagePicker && (
            // 우측 미리보기 — 고정 너비(w-32). 비율은 변형이 실제 슬라이드에서
            // 차지하는 비율과 정확히 일치시킨다:
            //   poster              : 9:16 (풀스크린 이미지) + 9:20 폰 좌우 회색 마스크
            //   polaroid / heart    : 1:1 (square 프레임)
            //   screen              : 1:1 (정방형 폴백; 실제는 이미지 비율에 따라 가변)
            //   arch / classic      : 3:4 (세로 액자)
            <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-32">
              <span className="text-sm font-medium text-foreground">메인 사진</span>
              <ImageUploader
                value={main.heroImage ?? null}
                onChange={(url) => patch('main', { ...main, heroImage: url })}
                invitationId={invitationId}
                folder="main"
                previewAspect={
                  isFrame
                    ? frame?.variant === 'arch' || frame?.variant === 'classic'
                      ? 'aspect-[3/4]'
                      : 'aspect-square'
                    : 'aspect-[9/16]'
                }
                previewFit={
                  isFrame
                    ? frame?.variant === 'screen'
                      ? 'contain'
                      : 'cover'
                    : design?.image.fit ?? 'cover'
                }
                previewPosition={
                  isFrame
                    ? frame?.imagePosition
                    : isPoster
                      ? design?.image.position
                      : undefined
                }
                // 9:20 비율 폰에서 좌우가 잘리는 영역을 회색으로 표시 — 포스터 전용.
                showWideAspectCropMask={isPoster}
                // 액자프레임 변형은 미리보기에 실제 프레임 셰이프를 적용해 잘릴 영역 가시화.
                frameVariant={isFrame ? frame?.variant : undefined}
                label="사진 선택"
              />
            </div>
          )}
        </div>

        {showImagePicker && isPoster && (
          <div className="rounded-md border border-dashed border-input bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">권장 이미지 규격</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>해상도: <strong>1080 × 1920 px</strong> (9:16 세로형)</li>
              <li>형식: JPG · PNG · WEBP (최대 25MB)</li>
              <li>중요한 인물·소품은 화면 중앙에 — 상하 약 15%는 그라데이션·텍스트가 덮을 수 있어요.</li>
              <li>
                스마트폰 기종(9:20 비율 등 길쭉한 화면)에서는 좌우가 약 7% 정도 잘릴 수 있어요. 미리보기 좌우의{' '}
                <span className="rounded bg-foreground/15 px-1 py-0.5 font-medium text-foreground">회색 영역</span>
                이 잘릴 수 있는 부분이에요.
              </li>
            </ul>
          </div>
        )}

        {isPoster && design && (
          <PosterDesignControls
            design={design}
            onChange={patchDesign}
            greeting={main.greeting}
            onGreetingChange={(greeting) => patch('main', { ...main, greeting })}
          />
        )}

        {isIllustration && illust && (
          <IllustrationDesignControls
            design={illust}
            onChange={patchIllust}
            greeting={main.greeting}
            onGreetingChange={(greeting) => patch('main', { ...main, greeting })}
          />
        )}

        {isText && text && (
          <TextDesignControls
            design={text}
            onChange={patchText}
            greeting={main.greeting}
            onGreetingChange={(greeting) => patch('main', { ...main, greeting })}
          />
        )}

        {isFrame && frame && (
          <FrameDesignControls
            design={frame}
            onChange={patchFrame}
            greeting={main.greeting}
            onGreetingChange={(greeting) => patch('main', { ...main, greeting })}
          />
        )}

        {/* 포스터/일러스트/텍스트/액자프레임 은 각 디자인 패널 내부 "인사말" 그룹에서 작성.
            여기에서는 폴백 인사말 입력란을 노출하지 않는다. */}
      </div>
    </SectionEditor>
  );
}

// ─────────────────────────────────────────────────────────────
// 포스터 디자인 컨트롤
// ─────────────────────────────────────────────────────────────

interface DesignProps {
  design: PosterDesign;
  onChange: (next: PosterDesign) => void;
  greeting: string;
  onGreetingChange: (next: string) => void;
}

export function PosterDesignControls({ design, onChange, greeting, onGreetingChange }: DesignProps) {
  const handleReset = () => {
    onChange(PosterDesignSchema.parse(undefined));
  };
  return (
    <div className="flex flex-col gap-5 rounded-md border border-input bg-muted/20 p-3">
      <DesignPanelHeader title="포스터 디자인" onReset={handleReset} />

      {/* 0. 이미지 위치 — 잘릴 수 있는 부분 안내 + 보일 영역 좌/우 상/하 선택. */}
      {design.image.fit === 'cover' && (
        <Group label="이미지 위치">
          <p className="text-xs text-muted-foreground">
            슬라이더로 사진에서 보일 영역의 중심을 선택하세요. 미리보기 좌우 회색 영역이 잘릴 수 있는 부분이에요.
          </p>
          <PositionSliders
            position={design.image.position}
            onChange={(position) =>
              onChange({ ...design, image: { ...design.image, position } })
            }
          />
        </Group>
      )}

      {/* 1. 이미지 표시 방법 — 일단 UI 숨김 (SHOW_IMAGE_FIT_OPTION 으로 다시 노출). */}
      {SHOW_IMAGE_FIT_OPTION && (
        <Group label="이미지 표시 방법">
          <div className="grid grid-cols-2 gap-2">
            <FitOptionButton
              selected={design.image.fit === 'contain'}
              onClick={() =>
                onChange({ ...design, image: { ...design.image, fit: 'contain' } })
              }
              title="전체 보기"
              hint={'이미지 전체를 잘리지 않게\n나머지는 배경색'}
            />
            <FitOptionButton
              selected={design.image.fit === 'cover'}
              onClick={() =>
                onChange({ ...design, image: { ...design.image, fit: 'cover' } })
              }
              title="프레임에 맞게 자르기"
              hint={'슬라이더로 보일 영역을\n선택해 프레임을 채움'}
            />
          </div>
          {design.image.fit === 'cover' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                슬라이더로 사진에서 보일 영역의 중심을 선택하세요.
              </p>
              <PositionSliders
                position={design.image.position}
                onChange={(position) =>
                  onChange({ ...design, image: { ...design.image, position } })
                }
              />
            </div>
          )}
        </Group>
      )}

      {/* 2. 이미지 효과 */}
      <Group label="이미지 효과">
        <ToggleRow
          label="하단 그라데이션"
          hint="배경색 톤으로 자연스럽게 페이드"
          checked={design.effects.gradient}
          onChange={(v) =>
            onChange({ ...design, effects: { ...design.effects, gradient: v } })
          }
        />
        <ToggleRow
          label="가장자리 테두리"
          hint="이미지 가장자리에서 살짝 띄운 직각 테두리"
          checked={design.effects.border}
          onChange={(v) =>
            onChange({ ...design, effects: { ...design.effects, border: v } })
          }
        />
      </Group>

      {/* 2. 제목 텍스트 */}
      <Group label="제목 텍스트">
        <TitleTextCombobox
          value={design.title.text}
          onChange={(text) =>
            onChange({ ...design, title: { ...design.title, text } })
          }
        />

        <FontPicker
          value={design.title.font}
          onChange={(font) =>
            onChange({ ...design, title: { ...design.title, font } })
          }
          previewText={design.title.text || 'Preview'}
        />

        <ColorPicker
          label="색상"
          value={design.title.color}
          onChange={(color) =>
            onChange({ ...design, title: { ...design.title, color } })
          }
          presets={TITLE_COLOR_PRESETS}
        />

        <SliderRow
          label="글자 크기"
          value={design.title.fontSize}
          min={20}
          max={56}
          unit="px"
          onChange={(fontSize) =>
            onChange({ ...design, title: { ...design.title, fontSize } })
          }
        />

        <ToggleRow
          label="애니메이션 효과"
          hint="왼쪽에서 오른쪽으로 천천히 써지는 느낌"
          checked={design.title.animate}
          onChange={(v) =>
            onChange({ ...design, title: { ...design.title, animate: v } })
          }
        />

        <PositionSliders
          position={design.title.position}
          onChange={(position) =>
            onChange({ ...design, title: { ...design.title, position } })
          }
        />
      </Group>

      {/* 3. 날짜 */}
      <Group
        label="날짜"
        toggle={{
          checked: design.dateBox.enabled,
          onChange: (v) =>
            onChange({ ...design, dateBox: { ...design.dateBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          전체 디자인의 폰트와 색상을 그대로 사용합니다.
        </p>
        {design.dateBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.dateBox.fontSize}
              min={12}
              max={28}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, dateBox: { ...design.dateBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.dateBox.position}
              onChange={(position) =>
                onChange({ ...design, dateBox: { ...design.dateBox, position } })
              }
            />
          </>
        )}
      </Group>

      {/* 4. 이름 */}
      <Group
        label="이름"
        toggle={{
          checked: design.nameBox.enabled,
          onChange: (v) =>
            onChange({ ...design, nameBox: { ...design.nameBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          신랑·신부 이름만 표시됩니다. 폰트와 색상은 전체 디자인을 따릅니다.
        </p>
        {design.nameBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.nameBox.fontSize}
              min={14}
              max={32}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, nameBox: { ...design.nameBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.nameBox.position}
              onChange={(position) =>
                onChange({ ...design, nameBox: { ...design.nameBox, position } })
              }
            />
          </>
        )}
      </Group>

      {/* 5. 인사말 — 토글 + 위치/크기 슬라이더 + 본문 입력. 토글 OFF 시 본문은 보존되지만 표시 안 됨. */}
      <Group
        label="인사말"
        toggle={{
          checked: design.messageBox.enabled,
          onChange: (v) =>
            onChange({ ...design, messageBox: { ...design.messageBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          폰트와 색상은 전체 디자인을 따릅니다.
        </p>
        {design.messageBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.messageBox.fontSize}
              min={12}
              max={28}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, messageBox: { ...design.messageBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.messageBox.position}
              onChange={(position) =>
                onChange({ ...design, messageBox: { ...design.messageBox, position } })
              }
            />
            <PresetTextArea
              label="인사말 내용"
              value={greeting}
              maxLength={500}
              rows={4}
              placeholder="저희 두 사람의 약속을 함께 축복해주세요"
              onChange={onGreetingChange}
              presets={MAIN_GREETING_PRESETS}
              presetLabel="추천 인사말"
            />
          </>
        )}
      </Group>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 이미지 표시 방법 옵션 버튼
// ─────────────────────────────────────────────────────────────

function FitOptionButton({
  selected,
  onClick,
  title,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-xs transition-colors ${
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-input bg-background text-foreground hover:bg-muted'
      }`}
    >
      <span className="font-medium">{title}</span>
      <span
        className={`whitespace-pre-line text-center leading-snug ${
          selected ? 'opacity-80' : 'text-muted-foreground'
        }`}
      >
        {hint}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// 일러스트형 디자인 컨트롤
// ─────────────────────────────────────────────────────────────

interface IllustProps {
  design: IllustrationDesign;
  onChange: (next: IllustrationDesign) => void;
  greeting: string;
  onGreetingChange: (next: string) => void;
}

const ILLUST_VARIANT_LABELS: Record<IllustrationVariant, { name: string; hint: string }> = {
  arch: { name: '꽃 아치', hint: '플로럴 아치 + 손잡은 커플' },
  dance: { name: '슬로우 댄스', hint: '댄스 포즈 + 골드 스파클' },
  hanbok: { name: '한복', hint: '전통 한복 차림의 신랑·신부' },
  ani: { name: '애니메이션', hint: '귀여운 일러스트 스타일' },
  car: { name: '웨딩 카', hint: 'MARRIED 사인 + 자동차에 탄 커플' },
};

export function IllustrationDesignControls({ design, onChange, greeting, onGreetingChange }: IllustProps) {
  const handleReset = () => {
    // variant 는 "타입" 선택이라 보존, 디자인 항목만 기본값으로.
    const defaults = IllustrationDesignSchema.parse(undefined);
    onChange({ ...defaults, variant: design.variant });
  };
  return (
    <div className="flex flex-col gap-5 rounded-md border border-input bg-muted/20 p-3">
      <DesignPanelHeader title="일러스트형 디자인" onReset={handleReset} />

      {/* 베리언트 선택 */}
      <Group label="일러스트 스타일">
        <div className="grid grid-cols-2 gap-2">
          {ILLUSTRATION_VARIANTS.map((key) => {
            const selected = design.variant === key;
            const meta = ILLUST_VARIANT_LABELS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ ...design, variant: key })}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-xs transition-colors ${
                  selected
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-input bg-background text-foreground hover:bg-muted'
                }`}
              >
                <span className="font-medium">{meta.name}</span>
                <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>
                  {meta.hint}
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      {/* 제목 텍스트 — 폰트 picker 노출 (포스터형과 동일). 초기화 시 Fraunces 가 기본 */}
      <Group label="제목 텍스트">
        <TitleTextCombobox
          value={design.title.text}
          onChange={(text) =>
            onChange({ ...design, title: { ...design.title, text } })
          }
        />
        <FontPicker
          value={design.title.font}
          onChange={(font) =>
            onChange({ ...design, title: { ...design.title, font } })
          }
          previewText={design.title.text || 'Preview'}
        />
        <ColorPicker
          label="색상"
          value={design.title.color}
          onChange={(color) =>
            onChange({ ...design, title: { ...design.title, color } })
          }
          presets={TITLE_COLOR_PRESETS}
          allowThemeDefault
        />
        <SliderRow
          label="글자 크기"
          value={design.title.fontSize}
          min={22}
          max={100}
          unit="px"
          onChange={(fontSize) =>
            onChange({ ...design, title: { ...design.title, fontSize } })
          }
        />
        <PositionSliders
          position={design.title.position}
          onChange={(position) =>
            onChange({ ...design, title: { ...design.title, position } })
          }
        />
      </Group>

      {/* 날짜 — 토글 + 글자 크기/상하 위치 조정 */}
      <Group
        label="날짜"
        toggle={{
          checked: design.dateBox.enabled,
          onChange: (v) =>
            onChange({ ...design, dateBox: { ...design.dateBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          일러스트 아래 표시됩니다. 폰트·색상은 전체 디자인을 따릅니다.
        </p>
        {design.dateBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.dateBox.fontSize}
              min={11}
              max={22}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, dateBox: { ...design.dateBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.dateBox.position}
              onChange={(position) =>
                onChange({ ...design, dateBox: { ...design.dateBox, position } })
              }
            />
          </>
        )}
      </Group>

      {/* 이름 — 토글 + 글자 크기/상하 위치 조정 */}
      <Group
        label="이름"
        toggle={{
          checked: design.nameBox.enabled,
          onChange: (v) =>
            onChange({ ...design, nameBox: { ...design.nameBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          신랑·신부 이름이 일러스트 아래 표시됩니다.
        </p>
        {design.nameBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.nameBox.fontSize}
              min={12}
              max={24}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, nameBox: { ...design.nameBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.nameBox.position}
              onChange={(position) =>
                onChange({ ...design, nameBox: { ...design.nameBox, position } })
              }
            />
          </>
        )}
      </Group>

      {/* 인사말 — 토글 + 글자 크기/상하 위치 + 본문 입력 */}
      <Group
        label="인사말"
        toggle={{
          checked: design.messageBox.enabled,
          onChange: (v) =>
            onChange({ ...design, messageBox: { ...design.messageBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          제목 바로 아래 부제 자리에 표시됩니다.
        </p>
        {design.messageBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.messageBox.fontSize}
              min={11}
              max={20}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, messageBox: { ...design.messageBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.messageBox.position}
              onChange={(position) =>
                onChange({ ...design, messageBox: { ...design.messageBox, position } })
              }
            />
          </>
        )}
        <PresetTextArea
          label="인사말 내용"
          value={greeting}
          maxLength={500}
          rows={4}
          placeholder="저희 두 사람의 약속을 함께 축복해주세요"
          onChange={onGreetingChange}
          presets={MAIN_GREETING_PRESETS}
          presetLabel="추천 인사말"
        />
      </Group>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 텍스트형 디자인 컨트롤 — 일러스트형과 같은 골격(제목·이름·날짜·인사말)
// + 가운데 데코 일러스트(꽃 / 편지) 변형 선택
// ─────────────────────────────────────────────────────────────

interface TextProps {
  design: TextDesign;
  onChange: (next: TextDesign) => void;
  greeting: string;
  onGreetingChange: (next: string) => void;
}

const TEXT_VARIANT_LABELS: Record<TextVariant, { name: string; hint: string }> = {
  flower: { name: '꽃', hint: '플로럴 라인 아트' },
  letter: { name: '편지', hint: '편지·봉투 일러스트' },
  none: { name: '없음', hint: '데코 이미지 없이 텍스트만' },
};

export function TextDesignControls({ design, onChange, greeting, onGreetingChange }: TextProps) {
  const handleReset = () => {
    // variant 는 "타입" 선택이라 보존, 디자인 항목만 기본값으로.
    const defaults = TextDesignSchema.parse(undefined);
    onChange({ ...defaults, variant: design.variant });
  };
  return (
    <div className="flex flex-col gap-5 rounded-md border border-input bg-muted/20 p-3">
      <DesignPanelHeader title="텍스트형 디자인" onReset={handleReset} />

      {/* 데코 변형 선택 — 꽃 / 편지 / 없음 3종 */}
      <Group label="데코 일러스트">
        <div className="grid grid-cols-3 gap-2">
          {TEXT_VARIANTS.map((key) => {
            const selected = design.variant === key;
            const meta = TEXT_VARIANT_LABELS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ ...design, variant: key })}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-xs transition-colors ${
                  selected
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-input bg-background text-foreground hover:bg-muted'
                }`}
              >
                <span className="font-medium">{meta.name}</span>
                <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>
                  {meta.hint}
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      {/* 제목 텍스트 — 폰트 picker 노출 (포스터형과 동일). 초기화 시 Playfair Display 가 기본 */}
      <Group label="제목 텍스트">
        <TitleTextCombobox
          value={design.title.text}
          onChange={(text) =>
            onChange({ ...design, title: { ...design.title, text } })
          }
        />
        <FontPicker
          value={design.title.font}
          onChange={(font) =>
            onChange({ ...design, title: { ...design.title, font } })
          }
          previewText={design.title.text || 'Preview'}
        />
        <ColorPicker
          label="색상"
          value={design.title.color}
          onChange={(color) =>
            onChange({ ...design, title: { ...design.title, color } })
          }
          presets={TITLE_COLOR_PRESETS}
          allowThemeDefault
        />
        <SliderRow
          label="글자 크기"
          value={design.title.fontSize}
          min={22}
          max={100}
          unit="px"
          onChange={(fontSize) =>
            onChange({ ...design, title: { ...design.title, fontSize } })
          }
        />
        <PositionSliders
          position={design.title.position}
          onChange={(position) =>
            onChange({ ...design, title: { ...design.title, position } })
          }
        />
      </Group>

      {/* 날짜 — 토글 + 글자 크기/상하 위치. 풀너비 데코 위로 올릴 수 있도록
          상하 위치 범위를 ±50cqh 로 확장. */}
      <Group
        label="날짜"
        toggle={{
          checked: design.dateBox.enabled,
          onChange: (v) =>
            onChange({ ...design, dateBox: { ...design.dateBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          데코 아래에 기본 위치. 상하 위치 슬라이더로 데코 위까지 올릴 수 있어요.
        </p>
        {design.dateBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.dateBox.fontSize}
              min={11}
              max={22}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, dateBox: { ...design.dateBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.dateBox.position}
              onChange={(position) =>
                onChange({ ...design, dateBox: { ...design.dateBox, position } })
              }
            />
          </>
        )}
      </Group>

      {/* 이름 — 토글 + 정렬(한 줄/두 줄) + 순서(신부 먼저) + 글자 크기/상하 위치 */}
      <Group
        label="이름"
        toggle={{
          checked: design.nameBox.enabled,
          onChange: (v) =>
            onChange({ ...design, nameBox: { ...design.nameBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          데코 아래에 기본 위치. 상하 위치로 데코 위까지 올릴 수 있고, 신랑·신부
          접두어는 표시되지 않습니다.
        </p>
        {design.nameBox.enabled && (
          <>
            {/* 정렬 — 4종: 한 줄(점) / 위·아래(✦) / 위·아래(— ♥ —) / 한 줄+세로선(♥) */}
            <div className="flex flex-col gap-1.5 text-xs">
              <span className="text-muted-foreground">정렬</span>
              <div className="grid grid-cols-2 gap-2">
                <NameLayoutButton
                  selected={design.nameBox.layout === 'inline'}
                  onClick={() =>
                    onChange({ ...design, nameBox: { ...design.nameBox, layout: 'inline' } })
                  }
                  title="한 줄"
                  hint="신랑 · 신부"
                />
                <NameLayoutButton
                  selected={design.nameBox.layout === 'stack'}
                  onClick={() =>
                    onChange({ ...design, nameBox: { ...design.nameBox, layout: 'stack' } })
                  }
                  title="위·아래"
                  hint={'신랑\n✦\n신부'}
                />
                <NameLayoutButton
                  selected={design.nameBox.layout === 'stackHeart'}
                  onClick={() =>
                    onChange({ ...design, nameBox: { ...design.nameBox, layout: 'stackHeart' } })
                  }
                  title="위·아래 + 하트"
                  hint={'신랑\n─ ♥ ─\n신부'}
                />
                <NameLayoutButton
                  selected={design.nameBox.layout === 'inlineCross'}
                  onClick={() =>
                    onChange({ ...design, nameBox: { ...design.nameBox, layout: 'inlineCross' } })
                  }
                  title="한 줄 + 십자"
                  hint={'│\n신랑 ♥ 신부\n│'}
                />
              </div>
            </div>

            <ToggleRow
              label="신부 이름 먼저"
              hint="신부 → 신랑 순서로 표시"
              checked={design.nameBox.brideFirst}
              onChange={(v) =>
                onChange({ ...design, nameBox: { ...design.nameBox, brideFirst: v } })
              }
            />

            <SliderRow
              label="글자 크기"
              value={design.nameBox.fontSize}
              min={14}
              max={56}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, nameBox: { ...design.nameBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.nameBox.position}
              onChange={(position) =>
                onChange({ ...design, nameBox: { ...design.nameBox, position } })
              }
            />
          </>
        )}
      </Group>

      {/* 인사말 — 토글 + 글자 크기/상하 위치 + 본문 입력 */}
      <Group
        label="인사말"
        toggle={{
          checked: design.messageBox.enabled,
          onChange: (v) =>
            onChange({ ...design, messageBox: { ...design.messageBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          제목 바로 아래 부제 자리. 상하 위치로 데코 위까지 내릴 수 있어요.
        </p>
        {design.messageBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.messageBox.fontSize}
              min={11}
              max={20}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, messageBox: { ...design.messageBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.messageBox.position}
              onChange={(position) =>
                onChange({ ...design, messageBox: { ...design.messageBox, position } })
              }
            />
          </>
        )}
        <PresetTextArea
          label="인사말 내용"
          value={greeting}
          maxLength={500}
          rows={4}
          placeholder="저희 두 사람의 약속을 함께 축복해주세요"
          onChange={onGreetingChange}
          presets={MAIN_GREETING_PRESETS}
          presetLabel="추천 인사말"
        />
      </Group>
    </div>
  );
}

// 텍스트형 이름 정렬 옵션 버튼 — "한 줄" / "위·아래" 두 가지 중 선택.
function NameLayoutButton({
  selected,
  onClick,
  title,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-[11px] transition-colors ${
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-input bg-background text-foreground hover:bg-muted'
      }`}
    >
      <span className="font-medium">{title}</span>
      <span
        className={`whitespace-pre-line text-center text-[10px] leading-snug ${
          selected ? 'opacity-80' : 'text-muted-foreground'
        }`}
      >
        {hint}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// 액자프레임 디자인 컨트롤 — 폴라로이드 / 하트 / 스크린 공용
// ─────────────────────────────────────────────────────────────

interface FrameProps {
  design: FrameDesign;
  onChange: (next: FrameDesign) => void;
  greeting: string;
  onGreetingChange: (next: string) => void;
}

const FRAME_VARIANT_LABELS: Record<FrameVariant, { name: string; hint: string }> = {
  polaroid: { name: '폴라로이드', hint: '흰 테두리 + 살짝 기울임' },
  heart: { name: '하트', hint: '하트 모양으로 클립' },
  screen: { name: '스크린', hint: '영화관 letterbox' },
  arch: { name: '아치', hint: '상단이 둥근 세로 액자' },
  classic: { name: '클래식', hint: '상하좌우 테두리 액자' },
};

export function FrameDesignControls({ design, onChange, greeting, onGreetingChange }: FrameProps) {
  const handleReset = () => {
    // variant 는 "타입" 선택이라 보존, 디자인 항목만 기본값으로.
    const defaults = FrameDesignSchema.parse(undefined);
    onChange({ ...defaults, variant: design.variant });
  };
  // screen 변형은 contain 으로 잘림 없음 — imagePosition 그룹을 숨긴다.
  const showImagePosition = design.variant !== 'screen';
  return (
    <div className="flex flex-col gap-5 rounded-md border border-input bg-muted/20 p-3">
      <DesignPanelHeader title="액자프레임 디자인" onReset={handleReset} />

      {/* 프레임 스타일 — 폴라로이드 / 하트 / 스크린 / 아치 / 클래식 변형 선택.
          5종이라 한 줄(3) + 두 번째 줄(2) 로 자연 줄바꿈. */}
      <Group label="프레임 스타일">
        <div className="grid grid-cols-3 gap-2">
          {FRAME_VARIANTS.map((key) => {
            const selected = design.variant === key;
            const meta = FRAME_VARIANT_LABELS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ ...design, variant: key })}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2.5 text-[11px] transition-colors ${
                  selected
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-input bg-background text-foreground hover:bg-muted'
                }`}
              >
                <span className="font-medium">{meta.name}</span>
                <span className={`text-[10px] leading-snug ${selected ? 'opacity-80' : 'text-muted-foreground'}`}>
                  {meta.hint}
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      {/* 이미지 위치 — screen 외 변형에서만 노출. 프레임에 보일 영역의 중심을 0–100% 로 선택. */}
      {showImagePosition && (
        <Group label="이미지 위치">
          <p className="text-xs text-muted-foreground">
            슬라이더로 사진에서 보일 영역의 중심을 선택하세요.
          </p>
          <PositionSliders
            position={design.imagePosition}
            onChange={(position) => onChange({ ...design, imagePosition: position })}
          />
        </Group>
      )}

      {/* 제목 텍스트 — 토글 + 문구 + 폰트 + 색 + 크기 + 상하 위치 */}
      <Group
        label="제목 텍스트"
        toggle={{
          checked: design.title.enabled,
          onChange: (v) =>
            onChange({ ...design, title: { ...design.title, enabled: v } }),
        }}
      >
        {design.title.enabled && (
          <>
            <TitleTextCombobox
              value={design.title.text}
              onChange={(text) =>
                onChange({ ...design, title: { ...design.title, text } })
              }
            />
            <FontPicker
              value={design.title.font}
              onChange={(font) =>
                onChange({ ...design, title: { ...design.title, font } })
              }
              previewText={design.title.text || 'Preview'}
            />
            <ColorPicker
              label="색상"
              value={design.title.color}
              onChange={(color) =>
                onChange({ ...design, title: { ...design.title, color } })
              }
              presets={TITLE_COLOR_PRESETS}
              allowThemeDefault
            />
            <SliderRow
              label="글자 크기"
              value={design.title.fontSize}
              min={18}
              max={100}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, title: { ...design.title, fontSize } })
              }
            />
            <PositionSliders
              position={design.title.position}
              onChange={(position) =>
                onChange({ ...design, title: { ...design.title, position } })
              }
            />
          </>
        )}
      </Group>

      {/* 날짜 — 토글 + 글자 크기 + 상하 위치 */}
      <Group
        label="날짜"
        toggle={{
          checked: design.dateBox.enabled,
          onChange: (v) =>
            onChange({ ...design, dateBox: { ...design.dateBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          폰트와 색상은 전체 디자인을 따릅니다.
        </p>
        {design.dateBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.dateBox.fontSize}
              min={11}
              max={22}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, dateBox: { ...design.dateBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.dateBox.position}
              onChange={(position) =>
                onChange({ ...design, dateBox: { ...design.dateBox, position } })
              }
            />
          </>
        )}
      </Group>

      {/* 이름 — 토글 + 글자 크기 + 상하 위치 */}
      <Group
        label="이름"
        toggle={{
          checked: design.nameBox.enabled,
          onChange: (v) =>
            onChange({ ...design, nameBox: { ...design.nameBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          신랑·신부 이름이 표시됩니다.
        </p>
        {design.nameBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.nameBox.fontSize}
              min={12}
              max={28}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, nameBox: { ...design.nameBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.nameBox.position}
              onChange={(position) =>
                onChange({ ...design, nameBox: { ...design.nameBox, position } })
              }
            />
          </>
        )}
      </Group>

      {/* 인사말 — 토글 + 글자 크기 + 상하 위치 + 본문 입력 */}
      <Group
        label="인사말"
        toggle={{
          checked: design.messageBox.enabled,
          onChange: (v) =>
            onChange({ ...design, messageBox: { ...design.messageBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          폰트와 색상은 전체 디자인을 따릅니다.
        </p>
        {design.messageBox.enabled && (
          <>
            <SliderRow
              label="글자 크기"
              value={design.messageBox.fontSize}
              min={11}
              max={22}
              unit="px"
              onChange={(fontSize) =>
                onChange({ ...design, messageBox: { ...design.messageBox, fontSize } })
              }
            />
            <PositionSliders
              position={design.messageBox.position}
              onChange={(position) =>
                onChange({ ...design, messageBox: { ...design.messageBox, position } })
              }
            />
            <PresetTextArea
              label="인사말 내용"
              value={greeting}
              maxLength={500}
              rows={4}
              placeholder="저희 두 사람의 약속을 함께 축복해주세요"
              onChange={onGreetingChange}
              presets={MAIN_GREETING_PRESETS}
              presetLabel="추천 인사말"
            />
          </>
        )}
      </Group>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 제목 문구 — 자유 입력 가능 + 화살표로 9개 프리셋 전체 펼침
// 모바일/웹 모두 같은 커스텀 패널이라 폰트·UX 일관.
// ─────────────────────────────────────────────────────────────

function TitleTextCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, () => setOpen(false));

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">문구</span>
      <div ref={wrapRef} className="relative">
        <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
          <input
            value={value}
            maxLength={60}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setOpen(false)}
            placeholder="문구를 직접 입력하거나 우측 화살표로 선택"
            className="h-10 flex-1 bg-transparent px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="문구 프리셋 펼치기"
            aria-expanded={open}
            className="grid w-9 shrink-0 place-items-center border-l border-input text-muted-foreground hover:bg-muted"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        {open && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-none overflow-hidden rounded-md border border-input bg-background shadow-lg"
          >
            {TITLE_TEXT_PRESETS.map((preset) => {
              const selected = preset === value;
              return (
                <li key={preset}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(preset);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? 'bg-foreground text-background'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {preset}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 폰트 선택 — 각 옵션을 해당 폰트로 렌더해 모바일/웹 모두에서
// 실제 글씨체를 보고 고를 수 있게 한다.
// ─────────────────────────────────────────────────────────────

function FontPicker({
  value,
  onChange,
  previewText,
}: {
  value: TitleFontKey;
  onChange: (next: TitleFontKey) => void;
  previewText: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, () => setOpen(false));

  // 제목 텍스트 언어에 따라 표시할 폰트 그룹을 결정.
  //   한글이면 한글 명조·고운바탕 계열만, 영문이면 기존 영문 장식 폰트만.
  // 사용자가 한글↔영문을 오갈 때 현재 선택된 폰트가 새 그룹에 속하지
  // 않으면 그 그룹의 기본 폰트로 자동 전환 (한 번만).
  const isKorean = isKoreanTitleText(previewText);
  const visibleKeys = isKorean
    ? TITLE_FONT_KEYS_KO
    : TITLE_FONT_KEYS_EN;
  const valueInGroup = (visibleKeys as readonly string[]).includes(value);

  useEffect(() => {
    if (valueInGroup) return;
    onChange(isKorean ? DEFAULT_TITLE_FONT_KO : DEFAULT_TITLE_FONT_EN);
    // onChange 는 부모 상태 업데이트 함수라 deps 에서 제외 (무한 루프 회피).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKorean, valueInGroup]);

  // 그룹 외 폰트 값이 일시적으로 들어오면 (구버전 데이터) 현재 그룹 기본
  // 폰트의 옵션을 임시 미리보기에 사용해 UI 가 깨지지 않게 한다.
  const current =
    TITLE_FONT_OPTIONS[value] ??
    TITLE_FONT_OPTIONS[isKorean ? DEFAULT_TITLE_FONT_KO : DEFAULT_TITLE_FONT_EN];

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">
        폰트 <span className="text-xs font-normal text-muted-foreground">({isKorean ? '한글' : '영문'})</span>
      </span>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-muted focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          <span className="truncate" style={{ fontFamily: current.family }}>
            {current.label}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-input bg-background shadow-lg"
          >
            {visibleKeys.map((key) => {
              const opt = TITLE_FONT_OPTIONS[key];
              const selected = key === value;
              return (
                <li key={key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors ${
                      selected
                        ? 'bg-foreground text-background'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span
                      className="truncate text-base leading-tight"
                      style={{ fontFamily: opt.family }}
                    >
                      {previewText || opt.label}
                    </span>
                    <span
                      className={`text-[11px] ${
                        selected ? 'text-background/70' : 'text-muted-foreground'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {/* 콤보박스 아래 큰 폰트 미리보기 — 그대로 유지. */}
      <span
        className="mt-1 truncate rounded bg-background px-2 py-2 text-base"
        style={{ fontFamily: current.family }}
      >
        {previewText || 'Preview'}
      </span>
    </div>
  );
}

function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  handler: () => void,
) {
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const node = ref.current;
      if (!node) return;
      if (e.target instanceof Node && node.contains(e.target)) return;
      handler();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [ref, handler]);
}

// ─────────────────────────────────────────────────────────────
// 공용 서브 컴포넌트
// ─────────────────────────────────────────────────────────────

/**
 * 디자인 패널 헤더 — 좌측 제목 + 우측 "초기화" 버튼.
 * onReset 호출 시 부모가 디자인 객체를 기본값으로 되돌린다.
 */
function DesignPanelHeader({ title, onReset }: { title: string; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <button
        type="button"
        onClick={onReset}
        className="rounded-md border border-input bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        초기화
      </button>
    </div>
  );
}

function Group({
  label,
  toggle,
  children,
}: {
  label: string;
  toggle?: { checked: boolean; onChange: (v: boolean) => void };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-input bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {toggle && <Switch checked={toggle.checked} onChange={toggle.onChange} label={label} />}
      </div>
      {(toggle ? toggle.checked : true) && (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-col">
        <span className="text-sm text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-5 w-9 shrink-0 items-center overflow-hidden rounded-full p-0.5 transition-colors ${
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function PositionSliders({
  position,
  onChange,
}: {
  position: { x: number; y: number };
  onChange: (next: { x: number; y: number }) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SliderRow
        label="좌우"
        value={position.x}
        min={0}
        max={100}
        leftHint="좌"
        rightHint="우"
        unit="%"
        onChange={(x) => onChange({ ...position, x })}
      />
      <SliderRow
        label="상하"
        value={position.y}
        min={0}
        max={100}
        leftHint="상"
        rightHint="하"
        unit="%"
        onChange={(y) => onChange({ ...position, y })}
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  leftHint,
  rightHint,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  leftHint?: string;
  rightHint?: string;
  unit?: string;
  onChange: (v: number) => void;
}) {
  // input 에 min-w-0 을 줘야 flex-row 안에서 우측 값 칸이 박스 밖으로 밀려나지 않음.
  // 라벨 폭을 살짝 줄이고(g-3→g-2), 우측 값 폭을 단위 길이까지 안전하게 수용 (w-14).
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      {leftHint && <span className="shrink-0 text-muted-foreground">{leftHint}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-foreground"
      />
      {rightHint && <span className="shrink-0 text-muted-foreground">{rightHint}</span>}
      <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
        {Math.round(value)}
        {unit ?? ''}
      </span>
    </label>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
  presets,
  allowThemeDefault,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: string[];
  /** true 면 "테마색" (currentColor) 옵션을 가장 앞에 노출. */
  allowThemeDefault?: boolean;
}) {
  const themeSelected = value === 'currentColor';
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {allowThemeDefault && (
          <button
            type="button"
            onClick={() => onChange('currentColor')}
            aria-label="테마 기본 색상"
            aria-pressed={themeSelected}
            title="테마 기본 색상"
            className={`flex h-7 items-center gap-1 rounded-full border-2 px-2 text-[10px] transition-shadow ${
              themeSelected
                ? 'border-foreground bg-foreground text-background shadow'
                : 'border-input bg-background text-foreground'
            }`}
          >
            테마색
          </button>
        )}
        {presets.map((preset) => {
          const selected = preset.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              aria-label={`색상 ${preset}`}
              aria-pressed={selected}
              className={`h-7 w-7 rounded-full border-2 transition-shadow ${
                selected ? 'border-foreground shadow' : 'border-input'
              }`}
              style={{ backgroundColor: preset }}
            />
          );
        })}
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label="사용자 지정 색상"
          className="h-7 w-9 cursor-pointer rounded border border-input bg-background p-0.5"
        />
      </div>
    </div>
  );
}

function normalizeHex(input: string) {
  // <input type="color"> 는 #rrggbb 만 허용 — 다른 포맷이면 흰색으로 폴백.
  if (/^#[0-9a-fA-F]{6}$/.test(input)) return input;
  return '#FFFFFF';
}
