# Kakao OAuth 설정 가이드

Supabase Auth로 카카오 소셜 로그인을 연결하는 절차. 한 번만 하면 됩니다.

## 1. Kakao Developers 앱 만들기

1. https://developers.kakao.com 접속 → 로그인
2. **내 애플리케이션 → 애플리케이션 추가하기**
   - 앱 이름: `미니멈 웨딩 스튜디오` (사용자에게 보임)
   - 사업자명: 임의 입력 가능 (개인 개발자 OK)
3. 생성된 앱의 **요약 정보** 페이지에서 두 값을 메모
   - **REST API 키** → `.env.local`의 `KAKAO_CLIENT_ID`
   - **앱 키 → Client Secret** (보안 메뉴에서 별도 발급) → `.env.local`의 `KAKAO_CLIENT_SECRET`

> Client Secret은 **앱 설정 → 보안 → Client Secret → 코드 생성** 후 **활성화 상태: 사용함** 까지 눌러야 적용됩니다.

## 2. 카카오 로그인 활성화

1. 좌측 메뉴 **제품 설정 → 카카오 로그인 → 활성화 설정 → ON**
2. **Redirect URI** 등록:
   ```
   https://<PROJECT_REF>.supabase.co/auth/v1/callback
   ```
   `<PROJECT_REF>`는 Supabase 프로젝트 URL의 서브도메인 (`https://abcd1234.supabase.co` → `abcd1234`).

   > ⚠️ 우리 앱 URL이 아니라 **Supabase URL**을 등록합니다. Supabase가 카카오로부터 코드를 받고, 다시 우리 앱의 `/auth/callback`으로 redirect 합니다.

3. **동의항목** 메뉴:
   - `닉네임` → 필수 동의 권장
   - `카카오계정(이메일)` → 필수 동의 (Supabase가 사용자 식별에 사용)
   - 나머지는 선택 또는 사용 안 함

## 3. 플랫폼 등록

**앱 설정 → 플랫폼 → Web 플랫폼 등록**:
- 사이트 도메인:
  - 개발: `http://localhost:3000`
  - 운영: `https://your-domain.com` (배포 후 추가)

## 4. Supabase에 카카오 Provider 등록

1. Supabase Dashboard → **Authentication → Providers**
2. **Kakao** 항목 펼치기 → **Enable Kakao Provider** ON
3. 입력값:
   - **Kakao Client ID (REST API key)**: 1단계의 REST API 키
   - **Kakao Client Secret**: 1단계의 Client Secret
4. **Save**

## 5. 우리 앱 콜백 URL 설정

Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000` (개발), 배포 후 운영 도메인으로 교체
- **Redirect URLs** (허용 목록, 여러 개 가능):
  ```
  http://localhost:3000/auth/callback
  https://your-domain.com/auth/callback
  https://*.vercel.app/auth/callback   ← 미리보기 배포용 (선택)
  ```

## 6. 동작 확인

Step 3 (인증 플로우) 완료 후 `/login`에서 카카오 버튼을 누르면 흐름은 이렇습니다:

```
앱 /login
  ↓ supabase.auth.signInWithOAuth({ provider: 'kakao' })
카카오 로그인 페이지
  ↓ 동의
https://<ref>.supabase.co/auth/v1/callback?code=...
  ↓ Supabase가 토큰 교환
앱 /auth/callback?code=...
  ↓ supabase.auth.exchangeCodeForSession()
앱 /editor 또는 원래 가려던 페이지
```

## 흔한 실수

- **Redirect URI mismatch** — Kakao Developers의 Redirect URI는 **Supabase URL**, 우리 앱이 아님
- **Site Domain 누락** — `localhost:3000`이 등록 안 되어 있으면 카카오 로그인 페이지에서 차단
- **Client Secret 활성화 안 함** — 발급만 하고 "사용함"으로 안 바꾸면 Supabase가 401 반환
- **이메일 동의 항목이 선택** — Supabase가 사용자 매칭에 이메일 사용. 필수 동의로 설정 권장
- **자녀 보호자 동의 필요 앱** — 비즈 앱 전환 후 검수 받아야 운영 가능. MVP는 개인 개발자 앱이면 충분

## 환경 변수 정리

`.env.local`에 들어갈 값:

```
KAKAO_CLIENT_ID=<REST API 키>
KAKAO_CLIENT_SECRET=<Client Secret>
```

> 사실 카카오 키는 **Supabase Dashboard에 입력**하는 것이 정상 경로입니다.
> 우리 `.env.local`에 두는 이유는 향후 카카오 알림톡 등 다른 SDK를 직접 호출할 때를 위한 백업용. 인증만 쓴다면 .env에 안 둬도 작동.
