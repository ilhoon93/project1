# 스냅 만들기 모드 흐름 예시 모달 — 이미지 파일

`/wedding-snap/create` 페이지의 **1. 사진 업로드** 단계 ModeCard 에 "예시 보기"
버튼이 있고, 클릭 시 ExampleFlowModal 이 열려 모드별 합성 흐름을 단계별 썸네일
로 보여줍니다. 이 디렉토리는 그 모달에 사용되는 이미지의 위치.

각 row 의 **카탈로그 칸은 `SNAP_CATALOG` 에서 자동으로 가져옵니다** (해당 id
의 마스터 이미지). 따라서 이 디렉토리에는 카탈로그 사본이 없어도 됩니다.
사용되는 카탈로그 id 는 [`ExampleFlowModal.tsx`](../../../src/components/snap/ExampleFlowModal.tsx)
의 `EXAMPLE_CATALOG_IDS` 상수 참고.

## 흐름

### 셀카로 만들기
```
신랑 단독 컷 만들기
  [신랑셀카] → [신랑앵커] → [카탈로그] → [결과]

신부 단독 컷 만들기
  [신부셀카] → [신부앵커] → [카탈로그] → [결과]

함께 컷 만들기
  [신랑앵커 + 신부앵커] → [카탈로그] → [결과]
```

### 커플 사진으로 만들기
```
예시 1
  [커플사진] → [카탈로그] → [결과]

예시 2
  [커플사진] → [카탈로그] → [결과]
```

## 파일 규약

| 경로 | 용도 |
| --- | --- |
| `selfies-groom-selfie.jpg` | 신랑 셀카 입력 예시 |
| `selfies-groom-anchor.jpg` | 신랑 앵커 결과 예시 (1번 row + 3번 row 의 좌측 앵커) |
| `selfies-groom-result.jpg` | 신랑 단독 카탈로그 합성 결과 |
| `selfies-bride-selfie.jpg` | 신부 셀카 입력 예시 |
| `selfies-bride-anchor.jpg` | 신부 앵커 결과 예시 (2번 row + 3번 row 의 우측 앵커) |
| `selfies-bride-result.jpg` | 신부 단독 카탈로그 합성 결과 |
| `selfies-together-result.jpg` | 함께 카탈로그 합성 결과 |
| `couple-input.jpg` | 커플 사진 입력 예시 (모달 모든 row 공통) |
| `couple-result-1.jpg` | 커플 예시 1 — 결과 (Beach Classic White 카탈로그 기준) |
| `couple-result-2.jpg` | 커플 예시 2 — 결과 (Paris Eiffel Walk 카탈로그 기준) |

코드에서 path 가 직접 지정되어 있어 admin 이 같은 이름으로 jpg 만 올리면 즉시
노출. 파일 미존재 시 `onError` → "준비 중" placeholder 박스로 fallback (UI 깨짐
없음).

## 권장 규격

- **비율**: 세로 3:4 (모달 안 56×72px 정도로 렌더 → 해상도는 자유)
- **해상도**: 가로 360px 이상 권장 (retina 대응)
- **용량**: 100KB 이하
- **내용**:
  - selfie 들 — 정면 얼굴이 잘 보이는 셀카 한 장씩
  - anchor 들 — 같은 사람의 앵커 생성 결과 (스튜디오 normalize 컷)
  - result 들 — 그 앵커로 만든 카탈로그 결과 (실제 운영 데이터 잘 나온 컷 추천)
  - couple-input — 두 사람이 함께 정면 반신 컷
- **컬러**: 셀카·앵커·결과의 톤이 너무 달라 보이지 않게 (사용자가 "변환 폭"
  체감을 명확히 받게)

## 카탈로그 칸 변경

EXAMPLE_CATALOG_IDS 상수의 id 만 변경하면 모달의 카탈로그 칸이 새 마스터로
교체됩니다 (이미지 파일 변경 없음):

```ts
const EXAMPLE_CATALOG_IDS = {
  groomSolo: 'groom-portrait-studio',   // 신랑 단독 row 카탈로그 칸
  brideSolo: 'bride-floral-bed-seated', // 신부 단독 row 카탈로그 칸
  together:  'studio-couple-blackwhite',// 함께 row 카탈로그 칸
  couple1:   'beach-classic-white',     // 커플 예시 1 row 카탈로그 칸
  couple2:   'paris-eiffel-walk',       // 커플 예시 2 row 카탈로그 칸
};
```

위 id 들은 모두 active (hidden:false) 상태여야 마스터 이미지가 로드됨.

## 파일이 없을 때

`onError` 핸들러가 자동으로 "준비 중" placeholder 박스를 표시. 모달 자체는 정상
동작, 카드 흐름 이해는 그대로 가능.

## Deprecated (이전 PR 의 파일들)

이전 PR (#154) 에서 사용했던 다음 파일들은 더 이상 사용되지 않습니다:
- `selfies-input.jpg` / `selfies-result.jpg`
- `couple-result.jpg`

남아 있어도 무해 (사용처 없음). 필요 시 git 으로 삭제.
