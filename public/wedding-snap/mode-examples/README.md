# 스냅 만들기 모드 흐름 예시 모달 — 이미지 파일

`/wedding-snap/create` 페이지의 **1. 사진 업로드** 단계 ModeCard 에 "예시 보기"
버튼이 있고, 클릭 시 ExampleFlowModal 이 열려 모드별 합성 흐름을 단계별 썸네일
로 보여줍니다. 이 디렉토리는 그 모달에 사용되는 이미지의 위치.

각 row 의 **카탈로그 칸은 `SNAP_CATALOG` 에서 자동으로 가져옵니다** (해당 id
의 마스터 이미지). 따라서 이 디렉토리에는 카탈로그 사본이 없어도 됩니다.
사용되는 카탈로그 id 는 [`ExampleFlowModal.tsx`](../../../src/components/snap/ExampleFlowModal.tsx)
의 `EXAMPLE_CATALOG_IDS` 상수 참고.

모든 썸네일은 클릭 시 lightbox 로 풀스크린 확대 가능 (ESC / 외부 클릭 / ✕ 닫기).

## 흐름

### 셀카로 만들기 — 3 row
```
신랑 단독 컷 만들기
  [신랑셀카 3장(정면/좌/우)] → [신랑앵커] → [카탈로그] → [결과]

신부 단독 컷 만들기
  [신부셀카 3장(정면/좌/우)] → [신부앵커] → [카탈로그] → [결과]

함께 컷 만들기
  [신랑앵커 + 신부앵커] → [카탈로그] → [결과]
```

### 커플 사진으로 만들기 — 2 row
```
예시 1
  [커플사진 1] → [카탈로그] → [결과]

예시 2
  [커플사진 2] → [카탈로그] → [결과]
```

(row 마다 다른 입력 사진 — 다양한 입력 케이스를 보여주기 위해 분리.)

## 파일 규약

### 셀카 모드 (10개)
| 경로 | 용도 |
| --- | --- |
| `selfies-groom-front.jpg` | 신랑 정면 셀카 |
| `selfies-groom-left.jpg` | 신랑 좌 45° 셀카 |
| `selfies-groom-right.jpg` | 신랑 우 45° 셀카 |
| `selfies-groom-anchor.jpg` | 신랑 앵커 결과 (row 1 + row 3 의 좌측 앵커) |
| `selfies-groom-result.jpg` | 신랑 단독 카탈로그 합성 결과 |
| `selfies-bride-front.jpg` | 신부 정면 셀카 |
| `selfies-bride-left.jpg` | 신부 좌 45° 셀카 |
| `selfies-bride-right.jpg` | 신부 우 45° 셀카 |
| `selfies-bride-anchor.jpg` | 신부 앵커 결과 (row 2 + row 3 의 우측 앵커) |
| `selfies-bride-result.jpg` | 신부 단독 카탈로그 합성 결과 |
| `selfies-together-result.jpg` | 함께 카탈로그 합성 결과 |

### 커플 모드 (4개)
| 경로 | 용도 |
| --- | --- |
| `couple-input-1.jpg` | 커플 예시 1 입력 사진 |
| `couple-result-1.jpg` | 커플 예시 1 결과 (Beach Classic White 기준) |
| `couple-input-2.jpg` | 커플 예시 2 입력 사진 |
| `couple-result-2.jpg` | 커플 예시 2 결과 (Paris Eiffel Walk 기준) |

코드에서 path 가 직접 지정되어 있어 admin 이 같은 이름으로 jpg 만 올리면 즉시
노출. 파일 미존재 시 `onError` → "준비 중" placeholder 박스로 fallback.

## 권장 규격

- **비율**: 세로 3:4 (모달 안 60~160px 폭으로 렌더 → lightbox 클릭 시 풀스크린이라 해상도 자유)
- **해상도**: 가로 600px 이상 권장 (lightbox 풀스크린 대응)
- **용량**: 200KB 이하
- **내용**:
  - selfies-*-front/left/right — 신랑/신부 각자 정면 + 좌45° + 우45° 셀카
  - selfies-*-anchor — 같은 사람의 앵커 생성 결과 (스튜디오 normalize 컷)
  - selfies-*-result, selfies-together-result — 카탈로그 합성 결과
  - couple-input-1/-2 — 두 사람이 함께 찍힌 정면 반신 컷, 서로 다른 입력 케이스로 다양성 보여주기
  - couple-result-* — 같은 번호의 input 을 베이스로 의상/배경 바꾼 결과
- **컬러**: 셀카·앵커·결과의 톤이 너무 달라 보이지 않게 (사용자가 "변환 폭" 체감을 명확히 받게)

## 카탈로그 칸 변경

EXAMPLE_CATALOG_IDS 상수의 id 만 변경하면 모달의 카탈로그 칸이 새 마스터로
교체됩니다 (이미지 파일 변경 없음):

```ts
const EXAMPLE_CATALOG_IDS = {
  groomSolo: 'groom-portrait-studio',
  brideSolo: 'bride-floral-bed-seated',
  together:  'studio-couple-blackwhite',
  couple1:   'beach-classic-white',
  couple2:   'paris-eiffel-walk',
};
```

위 id 들은 모두 active (admin 페이지에서 hidden 태그가 없거나 양쪽 모두 hidden 이
아닌) 상태여야 마스터 이미지가 정상 로드됨.

## Deprecated (이전 PR 의 파일들)

다음 파일들은 더 이상 사용되지 않습니다:
- `selfies-input.jpg` / `selfies-result.jpg` (PR #154 — 첫 1세트 슬롯)
- `selfies-front.jpg` / `selfies-left.jpg` / `selfies-right.jpg` (PR #165 —
  사람 구분 없는 3장 grid; 이번에 사람별로 다시 분리됨)
- `couple-result.jpg` (PR #154 — 단일 결과)
- `couple-input.jpg` (PR #160~#166 — 공통 입력; 이번에 couple-input-1/-2 로 분리)

남아 있어도 무해 (사용처 없음). 필요 시 git 으로 삭제.
