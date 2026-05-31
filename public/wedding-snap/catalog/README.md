# AI 웨딩스냅 — 카탈로그 마스터 샘플 이미지

이 폴더에 카탈로그 마스터 샘플 이미지를 업로드합니다. 사용자가 자기 신랑/신부
얼굴을 업로드하면 이 폴더의 이미지가 모델에게 "이 컷처럼 합성해" 라는 구도/배경
reference 로 함께 전달됩니다 (Strategy B — multi-image edit).

## 현재 카탈로그 규모

- **Together (커플) — 활성**: 61개 (스튜디오 / 한옥 / 도심 / 해외 풍경 포함)
- **Solo (단독) — 활성**: 24개 (신랑 솔로 / 신부 솔로)
- **총합**: 85개

랜딩 페이지(`/wedding-snap`) 와 생성 페이지(`/wedding-snap/create`) 양쪽 모두
카탈로그 그리드는 **24개/페이지 페이지네이션** 으로 표시되고, 검색 필터
(누가 / 배경 / 컷) + 모드(추천만 / 전체) + 정렬(추천순 / 인기순 / 좋아요순) 이
적용됩니다.

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
| `cinema-redseat-couple` | 영화관 레드시트 데이트 | `cinema-redseat-couple.jpg` |
| `hotel-corridor-couple-walk` | 호텔 복도 워킹샷 | `hotel-corridor-couple-walk.jpg` |
| `london-night-doubledecker` | 런던 야경 이층버스 | `london-night-doubledecker.jpg` |
| `groom-ivory-tux-warmwall` | 신랑 아이보리 턱시도 단독 | `groom-ivory-tux-warmwall.jpg` |
| `london-bigben-bridge-walk` | 런던 빅벤 다리 워킹 | `london-bigben-bridge-walk.jpg` |
| `jeju-forest-road-walk` | 제주 숲길 도로 워킹 | `jeju-forest-road-walk.jpg` |
| `flowershop-vespa-couple` | 플라워샵 베스파 | `flowershop-vespa-couple.jpg` |
| `rome-colosseum-sunset` | 로마 콜로세움 노을 | `rome-colosseum-sunset.jpg` |
| `tuscany-villa-arch-couple` | 토스카나 빌라 아치문 | `tuscany-villa-arch-couple.jpg` |
| `snowforest-blackwhite-couple` | 설경 숲 흑백 | `snowforest-blackwhite-couple.jpg` |
| `rooftop-bluesky-couple` | 루프탑 파란하늘 | `rooftop-bluesky-couple.jpg` |
| `groom-library-navy-tux` | 신랑 서재 네이비 턱시도 단독 | `groom-library-navy-tux.jpg` |
| `hanbok-couple-studio` | 한복 스튜디오 핑크·라일락 | `hanbok-couple-studio.jpg` |
| `studio-arch-window-couple` | 아치 창 + 베이지 슈트 머메이드 | `studio-arch-window-couple.jpg` |
| `garden-finger-heart` | 가든 손가락 하트 | `garden-finger-heart.jpg` |
| `beige-wall-cheek-lean` | 베이지 벽 머리 기댐 | `beige-wall-cheek-lean.jpg` |
| `meadow-blue-sky-couple` | 들판 푸른 하늘 풀신 | `meadow-blue-sky-couple.jpg` |
| `brick-cherry-blossom` | 적벽돌 + 벚꽃 | `brick-cherry-blossom.jpg` |
| `ceremony-flower-wall` | 예식장 꽃벽 + 촛불 | `ceremony-flower-wall.jpg` |
| `budapest-bastion-sunset` | 부다페스트 어부의 요새 골든아워 | `budapest-bastion-sunset.jpg` |
| `beach-backhug-redbouquet` | 해변 백허그 + 빨간 부케 | `beach-backhug-redbouquet.jpg` |
| `hanok-sunset-leather-jacket` | 한옥 노을 + 가죽 재킷 캐주얼 | `hanok-sunset-leather-jacket.jpg` |
| `nyc-times-square-couple` | 뉴욕 타임스퀘어 | `nyc-times-square-couple.jpg` |
| `vintage-car-shades-bouquet` | 빈티지 컨버터블 + 선글라스 | `vintage-car-shades-bouquet.jpg` |
| `meadow-shades-bouquet-seated` | 잔디밭 앉음 선글라스 들꽃 | `meadow-shades-bouquet-seated.jpg` |
| `london-bigben-couple` | 런던 빅벤 | `london-bigben-couple.jpg` |
| `porto-pink-sunset` | 포르토 핑크 노을 강변 | `porto-pink-sunset.jpg` |
| `mountain-pink-sunset-hug` | 산 핑크 노을 + 들어올림 포옹 | `mountain-pink-sunset-hug.jpg` |
| `studio-greenwall-glasses` | 다크 그린 스튜디오 + 안경 | `studio-greenwall-glasses.jpg` |
| `porto-balcony-sunset` | 포르토 발코니 골든아워 | `porto-balcony-sunset.jpg` |
| `prague-sunflower-cheer` | 프라하 + 해바라기 환호 | `prague-sunflower-cheer.jpg` |
| `yacht-cabin-lean` | 요트 캐빈 어깨 기댐 | `yacht-cabin-lean.jpg` |
| `beach-sunset-sparkler-couple` | 비치 일몰 스파클러 | `beach-sunset-sparkler-couple.jpg` |
| `brick-alley-blackwhite-couple` | 브릭 골목 흑백 미니드레스 | `brick-alley-blackwhite-couple.jpg` |
| `night-rain-umbrella-couple` | 비오는 밤 우산 산책 | `night-rain-umbrella-couple.jpg` |
| `hanok-royal-purple-couple` | 한옥 보라 한복 커플 | `hanok-royal-purple-couple.jpg` |
| `yosemite-trail-walk` | 요세미티 트레일 워킹 | `yosemite-trail-walk.jpg` |
| `vintage-parlor-veil-lap` | 빈티지 응접실 무릎 베개 | `vintage-parlor-veil-lap.jpg` |
| `jeju-rocky-veil-couple` | 제주 바위 일몰 베일 | `jeju-rocky-veil-couple.jpg` |
| `desert-vintage-convertible-couple` | 사막 빈티지 컨버터블 | `desert-vintage-convertible-couple.jpg` |
| `wooden-stairs-bouquet-couple` | 우드 계단 안개꽃 부케 | `wooden-stairs-bouquet-couple.jpg` |
| `countryside-sunflower-leather` | 시골길 해바라기 가죽자켓 | `countryside-sunflower-leather.jpg` |

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
| `groom-hotel-stairs` | 신랑 호텔 계단 단독 | `groom-hotel-stairs.jpg` |
| `bride-nyc-chrysler` | 신부 NYC 크라이슬러 빌딩 | `bride-nyc-chrysler.jpg` |
| `hanok-corridor-bride-peek` | 한옥 회랑 신부 한복 | `hanok-corridor-bride-peek.jpg` |
| `bride-pink-hanbok-studio` | 신부 핑크 한복 스튜디오 | `bride-pink-hanbok-studio.jpg` |
| `bride-rose-garden-pink-seated` | 신부 장미정원 핑크 드레스 | `bride-rose-garden-pink-seated.jpg` |

## 운영자 태그 시스템 (`/admin/snap-catalog-tags`)

각 카탈로그는 입력 조건 (셀카 모드 / 커플 전신) 별로 다음 4가지 태그 중 하나를
운영자가 부여할 수 있어요:

| 태그 | 사용자 페이지 노출 |
| --- | --- |
| `recommend` | ★추천 emerald 배지 표시 + 정렬 상단 |
| `caution` | "주의" amber 배지 표시 |
| `risky` | "비추" red 배지 표시 + 정렬 하단 |
| `hidden` | picker / 랜딩에서 완전 숨김 |
| (미설정) | safe (기본) 등급으로 표시 |

태그는 `snap_catalog_tags` 테이블에 저장 (마이그레이션 028) 되며 변경 즉시
사용자 페이지에 반영됩니다 (page-level `dynamic = 'force-dynamic'`).

picker 에서 카탈로그를 완전히 숨기려면 두 input_condition 양쪽 모두 `hidden`
으로 세팅하세요. 한쪽만 hidden 이면 그 모드에서만 노출에서 빠지고, 반대 모드
에선 그대로 보입니다.

**Hidden 처리**

- 마스터 이미지(jpg)가 없는 카탈로그는 `getAvailableCatalog()` 가 fs.statSync 로
  자동 제외하므로 별도 hidden 세팅 없이도 picker / landing 양쪽에서 안 보입니다.
- (이전엔 `catalog.ts` 의 `hidden:true` 필드로 관리했으나 admin 페이지로 일원화됐고,
  정의되어 있던 10개 hidden 항목 자체는 catalog.ts 에서 완전 제거됨.)

## 통계 관리 (`/admin/snap-catalog-stats`)

마이페이지의 좋아요 / 재생성 액션이 `snap_catalog_stats` view 로 집계되어
admin 페이지에서 카탈로그 × 모드(selfies / couple) 단위로 다음 지표를 볼 수 있어요:

- `gen_count` — 누적 완료된 생성 수
- `like_count` / `like_rate` — 좋아요 비율
- `regen_count` / `regen_rate` — 재생성 비율

like_rate 가 낮거나 regen_rate 가 높은 카탈로그는 운영자 검토 대상 (태그 조정 또는
prompt 보강).

이 통계는 사용자 페이지의 **정렬 옵션** ("인기순" / "좋아요순") 에도 사용됩니다.

## 새 카탈로그 추가

1. `SNAP_CATALOG` 에 새 항목 (id / label / hint / category / personality /
   framing / promptHint / faceMaskRegions / 등) 추가.
2. 같은 `id.jpg` 를 이 폴더에 업로드.
3. 다음 배포부터 자동 노출 — `getAvailableCatalog()` 가 fs 체크로 picker /
   랜딩 양쪽 검증.
4. (선택) admin 페이지에서 추천 / 주의 / 비추 태그 부여.

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
