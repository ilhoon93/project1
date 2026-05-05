# 일러스트형 메인 슬라이드 — 사용 안내

메인 화면을 **일러스트형**으로 선택하면 이 폴더의 PNG 가 그대로
모바일 청첩장 중앙에 그려집니다.

## 필요한 파일

| 파일 | 베리언트 | 설명 |
| --- | --- | --- |
| `illust-arch.png` | `arch` | 꽃 아치 + 손잡고 걷는 신랑·신부 |
| `illust-dance.png` | `dance` | 댄스 포즈 + 골드 스파클·하트 |

> 두 파일 모두 **투명 배경 PNG** 를 권장합니다. 다크 테마(미드나잇·더스크)에서
> 라인 아트가 `filter: invert(...)` 로 반전되어 잘 보이도록 설계되어
> 있는데, 불투명 배경 PNG 를 쓰면 다크 모드에서 사각형 잔상이 보일 수 있습니다.

## 권장 사양

- 비율: 세로형 (예: `1080 × 1350` 4:5, `1080 × 1920` 9:16 모두 OK)
- 폭: 가로 1080px 이상
- 형식: PNG, 알파 채널 포함
- 최대 용량: 2MB 이하 권장 (모바일 로딩 속도)

## 다크 모드 처리 원리

[`src/lib/theme.ts`](../../src/lib/theme.ts) 의 각 테마 팔레트가
`illustFilter` / `illustBlend` 값을 가집니다:

```ts
midnight: {
  // ...
  illustFilter: 'invert(0.95) hue-rotate(180deg)',
}
```

이 값이 `--mw-illust-filter` CSS 변수로 흘러들어가
[`src/components/invitation/slides/MainSlide.tsx`](../../src/components/invitation/slides/MainSlide.tsx)
의 `<img>` 에 적용됩니다.

테마별로 보이는 모습을 더 미세하게 조정하고 싶으면 `illustFilter` 값만
바꾸면 됩니다 (예: `invert(0.85)` 으로 살짝 회색 톤, 또는
`brightness(1.1) contrast(0.9)` 같은 미세 조정).

## 파일이 없을 때

`/illustrations/illust-arch.png` 등이 404 면 슬라이드는 자리에 다음과
같은 안내 박스를 보여줍니다:

```
┌──────────────────────────────────┐
│   일러스트 이미지 추가 필요        │
│                                  │
│   public/illustrations/...png    │
│                                  │
│   투명 배경 PNG 를 위 경로에 저장  │
└──────────────────────────────────┘
```
