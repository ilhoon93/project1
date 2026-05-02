# 로컬 한글 폰트 활성화 가이드

`HIDDEN_FONT_KEYS`(`src/lib/theme.ts`) 에 등록된 9 개 한글 폰트는 외부
CDN 의 안정성 문제로 picker 에서 임시 숨김 처리되어 있고, 비슷한 Google
Font 로 폴백된다. 이 문서를 따라 폰트 파일을 직접 받아 프로젝트에 넣으면
9 종 모두 picker 에 다시 노출되며, `next/font/local` 이 빌드 타임에
`/_next/static/` 으로 자체 호스팅하므로 외부 URL 변경에 영향받지 않는다.

---

## 1. 다운로드

각 페이지에서 **무료로 상업적 사용 가능한** 폰트 파일을 받는다. 압축이
풀린 뒤에는 `.ttf` 또는 `.otf` 가 들어 있는 경우가 많은데, 표 마지막 열의
**저장 파일명**은 `.woff2` 기준이다 — 변환 절차는 § 2 참고. (TTF 그대로
써도 `next/font/local` 은 동작하지만 woff2 가 가장 작고 빠르다.)

| # | 폰트 | 다운로드 페이지 | 라이선스 | 저장 파일명 |
|---|---|---|---|---|
| 1 | 나눔스퀘어 네오 | https://hangeul.naver.com/font | SIL OFL · 상업 가능 | `NanumSquareNeo-Variable.woff2` |
| 2 | G마켓 산스 | https://corp.gmarket.com/fonts/index.html | Gmarket · 상업 가능 | `GmarketSansTTFMedium.woff2` |
| 3 | 교보 손글씨 2024 (이유빈) | https://event.kyobobook.co.kr/ → "교보 손글씨" 검색 | 교보문고 · 상업 가능 | `KyoboHandwriting2024iyu.woff2` |
| 4 | 김정철 명조 | https://kimjungchul.com/ 또는 https://noonnu.cc/font_page/220 | 자유 · 상업 가능 | `KimjungchulMyungjo-Bold.woff2` |
| 5 | 가비아 마음결체 | https://font.gabia.com/ | 가비아 · 상업 가능 | `Gabia-Maeumgyeol.woff2` |
| 6 | 가비아 눌체 | https://font.gabia.com/ | 가비아 · 상업 가능 | `Gabia-Nul.woff2` |
| 7 | 가비아 흘돋체 | https://font.gabia.com/ | 가비아 · 상업 가능 | `Gabia-Heuldot.woff2` |
| 8 | 가비아 고스란체 | https://font.gabia.com/ | 가비아 · 상업 가능 | `Gabia-Gosran.woff2` |
| 9 | 가비아 청연체 | https://font.gabia.com/ | 가비아 · 상업 가능 | `Gabia-Cheongyeon.woff2` |

> 💡 **가비아 페이지에서 폰트가 안 보이면**: font.gabia.com 은 SPA 라
> 스크롤 또는 카테고리 필터로 폰트 목록이 동적으로 로드된다. 검색창에
> 한글 이름을 직접 입력하거나, "전체 글꼴" 카테고리에서 찾는다.
>
> 💡 **무료 한글 폰트 통합 카탈로그**: https://noonnu.cc 에 위 폰트
> 대부분이 정리되어 있고 다운로드 버튼이 한 페이지에 모여 있어 편하다.

---

## 2. (선택) TTF/OTF → WOFF2 변환

받은 파일이 woff2 가 아니라면 변환을 권장한다. 변환 없이 TTF/OTF 를
바로 써도 동작하지만 파일 크기가 2 ~ 3 배 크다.

### 옵션 A — 온라인 (가장 간단)

- https://cloudconvert.com/ttf-to-woff2 (배치 업로드 · 가입 불필요)
- https://everythingfonts.com/ttf-to-woff2

### 옵션 B — CLI (npm 패키지)

```bash
# npx 로 한 번씩 호출
npx ttf2woff2 NanumSquareNeo-Variable.ttf > NanumSquareNeo-Variable.woff2

# 또는 폴더 전체 변환
npm i -g ttf2woff2
for f in *.ttf; do ttf2woff2 < "$f" > "${f%.ttf}.woff2"; done
```

### 옵션 C — Python (fonttools)

```bash
pip install fonttools brotli
pyftsubset NanumSquareNeo-Variable.ttf \
  --output-file=NanumSquareNeo-Variable.woff2 \
  --flavor=woff2 \
  --unicodes='U+0020-007E,U+AC00-D7A3,U+3131-318E,U+1100-11FF'
```

`--unicodes` 옵션으로 한글 + 기본 ASCII 만 포함하면 파일 크기를 더 줄일
수 있다 (대략 1 / 5).

---

## 3. 파일 배치

받은 (또는 변환한) 9 개 파일을 다음 위치에 그대로 넣는다:

```
src/app/fonts/korean/
├── NanumSquareNeo-Variable.woff2
├── GmarketSansTTFMedium.woff2
├── KyoboHandwriting2024iyu.woff2
├── KimjungchulMyungjo-Bold.woff2
├── Gabia-Maeumgyeol.woff2
├── Gabia-Nul.woff2
├── Gabia-Heuldot.woff2
├── Gabia-Gosran.woff2
└── Gabia-Cheongyeon.woff2
```

파일명이 정확히 일치해야 한다 (대소문자 포함). 다른 이름으로 저장하고
싶다면 `src/app/layout.tsx` 의 `src` 경로도 같이 고쳐야 한다.

---

## 4. 코드 활성화 (3 곳 수정)

### (1) `src/app/layout.tsx`

`LOCAL KOREAN FONTS` 블록의 9 개 `localFont(...)` 선언과 `koreanFontVariables`
배열의 9 줄을 모두 **주석 해제**한다.

### (2) `src/lib/theme.ts` — `FONT_OPTIONS`

각 항목 위에 적힌 "활성화 시 family: ..." 주석대로 `family` 문자열을
교체한다.

```diff
  nanumSquare: {
-   family: "var(--font-noto-sans-kr), sans-serif",
+   family: "var(--font-nanum-square), var(--font-noto-sans-kr), sans-serif",
  },
  gmarket: {
-   family: "var(--font-noto-sans-kr), sans-serif",
+   family: "var(--font-gmarket), var(--font-noto-sans-kr), sans-serif",
  },
  kyoboYubin: {
-   family: "var(--font-gaegu), cursive",
+   family: "var(--font-kyobo-yubin), cursive",
  },
  kimjungchul: {
-   family: "var(--font-noto-sans-kr), sans-serif",
+   family: "var(--font-kimjungchul), serif",
  },
  gabiaMaeum: {
-   family: "var(--font-gowun-batang), serif",
+   family: "var(--font-gabia-maeum), serif",
  },
  gabiaNul: {
-   family: "var(--font-gowun-batang), serif",
+   family: "var(--font-gabia-nul), serif",
  },
  gabiaHeuldot: {
-   family: "var(--font-gowun-batang), serif",
+   family: "var(--font-gabia-heuldot), serif",
  },
  gabiaGosran: {
-   family: "var(--font-gowun-batang), serif",
+   family: "var(--font-gabia-gosran), serif",
  },
  gabiaCheongyeon: {
-   family: "var(--font-gowun-batang), serif",
+   family: "var(--font-gabia-cheongyeon), serif",
  },
```

### (3) `src/lib/theme.ts` — `HIDDEN_FONT_KEYS` 비우기

```diff
- export const HIDDEN_FONT_KEYS = new Set<FontKey>([
-   'nanumSquare',
-   'gmarket',
-   'kyoboYubin',
-   'kimjungchul',
-   'gabiaMaeum',
-   'gabiaNul',
-   'gabiaHeuldot',
-   'gabiaGosran',
-   'gabiaCheongyeon',
- ]);
+ export const HIDDEN_FONT_KEYS = new Set<FontKey>();
```

> 일부만 받았다면 받은 폰트의 키만 `HIDDEN_FONT_KEYS` 에서 제거하면
> 된다. 나머지는 폴백 그대로 동작한다.

---

## 5. 빌드/검증

```bash
npm run dev
# 또는
npm run build && npm start
```

- 디자인 → 폰트 picker 에서 새로 활성화한 폰트 선택
- 미리보기 화면에서 글자가 해당 폰트로 렌더되는지 확인
- 브라우저 DevTools Network 탭 → 폰트 파일이 `/_next/static/media/...`
  경로에서 200 응답으로 로드되는지 확인 (외부 도메인 요청이 아님)

---

## 6. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `Module not found: Can't resolve './fonts/korean/...'` | 파일명·경로 오타. § 3 의 정확한 파일명과 비교 |
| 한글이 □ 로 표시 | 다운로드한 파일에 한글 글리프가 없음. 원본 파일이 라틴 전용일 수 있음 — 한글 포함 버전 다시 다운로드 |
| 이름은 바뀌었는데 글꼴 모양은 그대로 | 캐시 — 하드 리프레시 (Ctrl/Cmd+Shift+R), `.next` 디렉터리 삭제 후 재빌드 |
| 빌드는 성공하나 운영 환경에서 폰트 누락 | `next/font/local` 은 빌드 시점에 파일을 인라인하므로 빌드 머신에 폰트 파일이 있어야 함. CI 에 파일 커밋 필요 |
| 파일 용량이 너무 커서 커밋이 망설여짐 | § 2 옵션 C 의 `pyftsubset --unicodes` 로 한글만 추출. 전체 9 종 약 5 MB 정도로 줄일 수 있다 |

---

## 7. 라이선스 / 재배포 주의

- 9 종 모두 자유 사용·상업적 사용을 허용하지만, 일부는 **재배포 시
  원 라이선스 텍스트 동봉**을 요구한다 (가비아, 교보 등).
- 폰트 파일을 깃 저장소에 커밋한다는 것은 사실상 재배포에 해당하므로,
  `src/app/fonts/korean/LICENSE-<폰트명>.txt` 형태로 각 폰트 라이선스
  파일도 함께 커밋해 두면 안전하다.
- 라이선스 원문은 보통 다운로드 zip 안의 `LICENSE.txt` / `License.txt`
  / `라이선스.txt` 로 들어 있다.
