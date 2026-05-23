# AI 웨딩스냅 — 카탈로그 마스터 샘플 이미지

이 폴더에 카탈로그 마스터 샘플 이미지를 업로드합니다. 사용자가 자기 신랑/신부
얼굴을 업로드하면 이 폴더의 이미지가 모델에게 "이 컷처럼 합성해" 라는 구도/배경
reference 로 함께 전달됩니다 (Strategy B — multi-image edit).

## 업로드 위치 / 파일명

`public/wedding-snap/catalog/{id}.jpg`

`{id}` 는 [`src/lib/snap/catalog.ts`](../../../src/lib/snap/catalog.ts) 의
`SNAP_CATALOG` 배열에 정의된 항목의 `id` 와 정확히 일치해야 합니다.

현재 정의된 항목:

**Together (커플) — 활성**
| id | 라벨 | 파일 경로 |
| --- | --- | --- |
| `beach-classic-white` | 비치 클래식 화이트 | `beach-classic-white.jpg` |
| `seoul-nightview` | 서울 야경 루프탑 | `seoul-nightview.jpg` |
| `studio-floral-pastel` | 플라워 파스텔 스튜디오 | `studio-floral-pastel.jpg` |
| `desert-warm-walk` | 사막 웨딩 워킹 | `desert-warm-walk.jpg` |
| `meadow-casual-shades` | 잔디밭 캐주얼 선글라스 | `meadow-casual-shades.jpg` |
| `bridge-night-noir` | 브릿지 야경 누아르 | `bridge-night-noir.jpg` |
| `canola-field-walk` | 유채꽃밭 산책 | `canola-field-walk.jpg` |
| `studio-couple-puppy` | 스튜디오 강아지 동반 | `studio-couple-puppy.jpg` |
| `studio-couple-overhead` | 스튜디오 머리 위 손 장난 | `studio-couple-overhead.jpg` |
| `countryside-bicycle-sunset` | 시골길 자전거 골든아워 | `countryside-bicycle-sunset.jpg` |
| `garden-champagne-toast` | 가든 샴페인 토스트 | `garden-champagne-toast.jpg` |
| `studio-couple-blackwhite` | 흑백 스튜디오 풀신 | `studio-couple-blackwhite.jpg` |
| `studio-shoulder-lean` | 스튜디오 어깨 기댐 클로즈업 | `studio-shoulder-lean.jpg` |
| `yacht-sunset-hug` | 요트 일몰 백허그 | `yacht-sunset-hug.jpg` |
| `conservatory-sofa-couple` | 온실 화이트 소파 | `conservatory-sofa-couple.jpg` |
| `tokyo-alley-couple` | 도쿄 골목 자판기 | `tokyo-alley-couple.jpg` |
| `wall-casual-noir` | 캐주얼 흑백 벽 + 선글라스 | `wall-casual-noir.jpg` |
| `jeju-stonewall-cheer` | 제주 돌담 부케 환호 | `jeju-stonewall-cheer.jpg` |
| `paris-bridge-night` | 파리 다리 야경 | `paris-bridge-night.jpg` |
| `jeju-rocky-coast` | 제주 해안 정자세 | `jeju-rocky-coast.jpg` |
| `city-goldenhour-balcony` | 도심 골든아워 발코니 | `city-goldenhour-balcony.jpg` |
| `agave-rustwall-couple` | 아가베 + 적갈색 벽 어반네추럴 | `agave-rustwall-couple.jpg` |
| `studio-classic-greenbouquet` | 클래식 스튜디오 그린 부케 | `studio-classic-greenbouquet.jpg` |
| `city-walk-vsign-noir` | 흑백 도심 워킹 V사인 | `city-walk-vsign-noir.jpg` |
| `studio-noir-floor-purple` | 화이트 바닥 검정 드레스 라일락 | `studio-noir-floor-purple.jpg` |
| `studio-ivory-satin-couple` | 크림 스튜디오 새틴 머메이드 | `studio-ivory-satin-couple.jpg` |
| `studio-ceremony-closeup` | 결혼식 클로즈업 + 티아라 | `studio-ceremony-closeup.jpg` |
| `paris-eiffel-walk` | 파리 에펠탑 보도 워킹 | `paris-eiffel-walk.jpg` |
| `vintage-90s-street-vsign` | 90s 빈티지 거리 V사인 | `vintage-90s-street-vsign.jpg` |
| `vintage-90s-street-fullbody` | 90s 빈티지 거리 풀신 | `vintage-90s-street-fullbody.jpg` |
| `cinema-popcorn-couple` | 영화관 팝콘 데이트 | `cinema-popcorn-couple.jpg` |
| `hanbok-couple-studio` | 한복 스튜디오 핑크·라일락 | `hanbok-couple-studio.jpg` |
| `studio-arch-window-couple` | 아치 창 + 베이지 슈트 머메이드 | `studio-arch-window-couple.jpg` |
| `garden-finger-heart` | 가든 손가락 하트 | `garden-finger-heart.jpg` |
| `beige-wall-cheek-lean` | 베이지 벽 머리 기댐 | `beige-wall-cheek-lean.jpg` |
| `meadow-blue-sky-couple` | 들판 푸른 하늘 풀신 | `meadow-blue-sky-couple.jpg` |

**Solo (단독) — 활성**
| id | 라벨 | 파일 경로 |
| --- | --- | --- |
| `groom-portrait-studio` | 신랑 스튜디오 단독 | `groom-portrait-studio.jpg` |
| `bride-vintage-car` | 신부 빈티지 카 | `bride-vintage-car.jpg` |
| `bride-garden-twirl` | 신부 가든 베일 트월 | `bride-garden-twirl.jpg` |
| `bride-veil-closeup` | 신부 베일 클로즈업 | `bride-veil-closeup.jpg` |
| `hanok-greenhanbok-peek` | 한옥 한복 문 너머 엿보기 | `hanok-greenhanbok-peek.jpg` |
| `groom-monochrome-suit` | 신랑 흑백 슈트 | `groom-monochrome-suit.jpg` |
| `bride-villa-staircase` | 신부 빌라 돌계단 | `bride-villa-staircase.jpg` |
| `bride-paris-eiffel` | 신부 파리 에펠탑 | `bride-paris-eiffel.jpg` |
| `groom-meadow-bowtie` | 신랑 잔디밭 보타이 | `groom-meadow-bowtie.jpg` |
| `groom-bouquet-sniff` | 신랑 부케 향 | `groom-bouquet-sniff.jpg` |
| `bride-vintage-car-stand` | 신부 빈티지카 + 숲 | `bride-vintage-car-stand.jpg` |
| `groom-vintage-window` | 신랑 빈티지 인테리어 창가 | `groom-vintage-window.jpg` |
| `bride-sofa-ballgown` | 신부 화이트 카우치 볼가운 | `bride-sofa-ballgown.jpg` |
| `bride-garden-ballgown` | 신부 정원 풀턱 + 사이드 브레이드 | `bride-garden-ballgown.jpg` |
| `bride-mirror-lipstick` | 신부 거울 앞 립스틱 | `bride-mirror-lipstick.jpg` |
| `groom-fullbody-classic` | 신랑 풀신 클래식 슈트 | `groom-fullbody-classic.jpg` |
| `bride-floral-bed-seated` | 신부 꽃밭 앉음 | `bride-floral-bed-seated.jpg` |
| `bride-offshoulder-bouquet` | 신부 오프숄더 풀신 | `bride-offshoulder-bouquet.jpg` |
| `groom-beach-greensuit` | 신랑 해변 그린 슈트 | `groom-beach-greensuit.jpg` |

**Hidden (정의만 유지 · picker 노출 X)**

`hidden:true` 로 마킹된 항목은 [`SNAP_CATALOG`](../../../src/lib/snap/catalog.ts) 에는
정의가 남아 있어 `findSnapCatalog` 가 과거 결과물의 라벨 lookup 에는 응답하지만,
랜딩 미리보기 / 스냅 생성 picker 양쪽에서 모두 숨겨진다. 마스터 jpg 를 올린 뒤
`hidden:true` 만 제거하면 즉시 활성화.

| id | 라벨 | 사유 |
| --- | --- | --- |
| `studio-classic` | 클래식 스튜디오 | 마스터 미업로드 (대체 컷 `studio-classic-greenbouquet`) |
| `meadow-spring` | 야외 가든 | 마스터 삭제됨 (대체 컷 `meadow-blue-sky-couple`) |
| `bridge-goldenhour` | 브릿지 골든아워 | 마스터 삭제됨 (대체 컷 `city-goldenhour-balcony`) |
| `bride-bouquet` | 신부 부케 | 마스터 삭제됨 (대체 컷 `bride-offshoulder-bouquet`) |
| `hanok-courtyard` | 한옥 정원 | 마스터 미업로드 |
| `city-goldenhour` | 도심 골든아워 | 마스터 미업로드 (대체 컷 `city-goldenhour-balcony`) |
| `beach-sunset` | 바닷가 석양 | 마스터 미업로드 |
| `groom-walk-away` | 신랑 뒤돌아 걷는 컷 | 마스터 미업로드 |
| `bride-veil-flow` | 신부 베일 자연광 | 마스터 미업로드 (유사 컷 `bride-garden-twirl`) |
| `bride-window` | 신부 창가 자연광 | 마스터 미업로드 |

새 카탈로그 추가 시: `SNAP_CATALOG` 에 항목을 추가하고 같은 `id` 의 jpg 를
이 폴더에 올리면 즉시 노출/사용됩니다 (`getAvailableCatalog()` 가 파일 유무를
서버사이드에서 자동 체크하므로 별도 토글 불필요).

## 합성 방식별 결과 예시 (선택, 카탈로그-별 N장 그리드용)

`public/wedding-snap/catalog/examples/<id>-<mode>.jpg` 규칙으로 strict /
prompt-only 두 모드의 예시 결과 이미지를 올리면 스냅 생성 페이지의 "4. 합성
방식" 단계에서 자동으로 노출됩니다.

> 1. 사진 업로드 모드 카드 (셀카 / 커플) 에 대표 1세트씩 보여주는 입력→결과
> 예시는 별도 디렉토리 `public/wedding-snap/mode-examples/` 를 사용합니다
> (해당 디렉토리의 README 참고).

```
examples/studio-couple-blackwhite-strict.jpg
examples/studio-couple-blackwhite-prompt-only.jpg
examples/canola-field-walk-strict.jpg
examples/canola-field-walk-prompt-only.jpg
...
```

파일이 없으면 onError → 카탈로그 마스터 이미지로 자동 fallback. 새 예시를 추가
해도 별도 코드 수정 없이 즉시 노출.

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

`getAvailableCatalog()` (서버사이드 fs 체크) 가 자동으로 해당 항목을 picker /
랜딩 미리보기 양쪽에서 숨깁니다. 사용자가 그 항목을 우연히 고를 일이 없으니
"선택했는데 생성 실패" 케이스는 발생하지 않습니다. 카탈로그 정의는 코드에
남아 있어 마스터 jpg 만 올리면 다음 배포부터 자동 노출.

## 로컬 개발 시 주의

`fal.ai` 가 카탈로그 이미지를 외부에서 fetch 해야 하므로 `localhost:3000` 으로는
도달할 수 없습니다. 실제 생성 테스트는 다음 중 하나로:
- **Vercel preview 배포** 에서 테스트 (가장 권장)
- 또는 ngrok 등 터널로 임시 공개 URL 생성

UI/UX (업로드, 카탈로그 선택, 폴링) 자체는 localhost 에서도 확인 가능 — 단
`/api/snap/generate` 호출만 실제 fal 응답을 받지 못함.
