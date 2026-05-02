# 한글 로컬 폰트 디렉터리

picker 에서 임시로 숨겨둔 9 개 한글 폰트(`HIDDEN_FONT_KEYS`)는 외부 CDN 이
불안정해 빌드 결과물에 의존하지 않게 옮기는 중입니다. 폰트 파일을 이
폴더에 직접 받아두고 `src/app/layout.tsx` 의 _LOCAL KOREAN FONTS_ 블록을
주석 해제하면 자동으로 picker 에 다시 노출됩니다.

> 자세한 다운로드 URL · 파일명 · 코드 활성화 절차는 **`docs/local-fonts-guide.md`**
> 를 참고하세요.

## 예상 파일 구조 (모든 파일을 받았을 때)

```
src/app/fonts/korean/
├── README.md
├── .gitkeep
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

## .gitignore 정책

폰트 파일은 라이선스가 자유 사용을 허용해도 **저장소 크기가 빠르게 커지므로
필요한 폰트만 선택적으로 커밋**하는 것을 권장합니다. 9 종 모두 추가하면
대략 5 ~ 8 MB 정도 추가됩니다.
