# AI 웨딩스냅 — 카탈로그 마스터 샘플 이미지

이 폴더에 카탈로그 마스터 샘플 이미지를 업로드합니다. 사용자가 자기 신랑/신부
얼굴을 업로드하면 이 폴더의 이미지가 모델에게 "이 컷처럼 합성해" 라는 구도/배경
reference 로 함께 전달됩니다 (Strategy B — multi-image edit).

## 업로드 위치 / 파일명

`public/wedding-snap/catalog/{id}.jpg`

`{id}` 는 [`src/lib/snap/catalog.ts`](../../../src/lib/snap/catalog.ts) 의
`SNAP_CATALOG` 배열에 정의된 항목의 `id` 와 정확히 일치해야 합니다.

현재 정의된 항목:

**Together (커플)**
| id | 라벨 | 파일 경로 |
| --- | --- | --- |
| `studio-classic` | 클래식 스튜디오 | `studio-classic.jpg` |
| `meadow-spring` | 봄날 초원 | `meadow-spring.jpg` |
| `hanok-courtyard` | 한옥 정원 | `hanok-courtyard.jpg` |
| `city-goldenhour` | 도심 골든아워 | `city-goldenhour.jpg` |
| `beach-sunset` | 바닷가 석양 | `beach-sunset.jpg` |
| `bridge-goldenhour` | 브릿지 골든아워 | `bridge-goldenhour.jpg` |

**Solo (단독)**
| id | 라벨 | 파일 경로 |
| --- | --- | --- |
| `groom-portrait-studio` | 신랑 스튜디오 단독 | `groom-portrait-studio.jpg` |
| `bride-bouquet` | 신부 부케 | `bride-bouquet.jpg` |
| `groom-walk-away` | 신랑 뒤돌아 걷는 컷 | `groom-walk-away.jpg` |
| `bride-veil-flow` | 신부 베일 자연광 | `bride-veil-flow.jpg` |
| `bride-window` | 신부 창가 자연광 | `bride-window.jpg` |
| `bride-vintage-car` | 신부 빈티지 카 | `bride-vintage-car.jpg` |

새 카탈로그 추가 시: `SNAP_CATALOG` 에 항목을 추가하고 같은 `id` 의 jpg 를
이 폴더에 올리면 즉시 노출/사용됩니다.

## 권장 규격

- **비율**: 세로 4:3 (1024×1536 가 최적 — 모델이 portrait_4_3 사이즈로 동작)
- **해상도**: 가로 1024px 이상, 2048px 이하
- **형식**: JPG (또는 PNG/WEBP)
- **용량**: 2MB 이하 권장
- **내용**: 가상 모델 신랑·신부 한 쌍이 카탈로그 컨셉(예: 한옥 정원, 도심
  골든아워) 안에 자연스럽게 자리 잡은 베스트샷. 마스터 샘플 자체는 한 번만
  잘 만들어 두면 평생 자산이 됩니다.

마스터 샘플 자체를 어떻게 만드는지:
- gpt-image-2 high quality 로 한 번에 한 장씩 직접 생성 (회당 ≈$0.20)
- 또는 외부 스튜디오 사진을 사용 (저작권 OK 한 것만)
- 또는 기존 운영 중인 다른 웨딩 사진을 재가공

## 파일이 없을 때

해당 카탈로그 항목의 썸네일 자리에 안내 박스가 보이고, 파일 경로를 표시합니다.
사용자는 그 항목을 선택해 생성을 시도해도 fal.ai 가 이미지를 fetch 하지 못해
실패합니다. 카탈로그를 추가했다면 반드시 같은 `id` 의 이미지도 함께 업로드.

## 로컬 개발 시 주의

`fal.ai` 가 카탈로그 이미지를 외부에서 fetch 해야 하므로 `localhost:3000` 으로는
도달할 수 없습니다. 실제 생성 테스트는 다음 중 하나로:
- **Vercel preview 배포** 에서 테스트 (가장 권장)
- 또는 ngrok 등 터널로 임시 공개 URL 생성

UI/UX (업로드, 카탈로그 선택, 폴링) 자체는 localhost 에서도 확인 가능 — 단
`/api/snap/generate` 호출만 실제 fal 응답을 받지 못함.
