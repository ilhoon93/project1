# 네이버 스마트스토어 크레딧 적립 — 개발 내역 & 배포·설정 가이드

> 브랜치: `claude/mobile-whitespace-naver-features-NISXk`
> 작성: 2026-06

모바일 헤더 흰 공백 수정 + 네이버 스마트스토어 주문번호 입력 → **옵션 단위 다중
크레딧 적립** 기능을 구현하면서 정리한 문서. 배포 순서와, 나중에 처리할 커머스
API / 고정 IP 프록시 설정 가이드를 함께 담는다.

---

## 1. 이번 작업 변경 요약

| 영역 | 변경 | 주요 파일 |
|---|---|---|
| UI | 모바일 로그인 후 우측 흰 공백 제거 (이메일 pill 을 `< sm` 에서 아이콘만 표시) | `src/components/marketing/HeaderNav.tsx` |
| UI | 중복된 "네이버 연결" 카드 제거 (로그인이 네이버 단독이라 이미 연동됨) | `src/app/(marketing)/mypage/mypage-client.tsx` |
| DB | `grant_purchase_credits` 컬럼명/멱등성 키 정정 | `supabase/migrations/039_grant_purchase_credits_column_fix.sql` |
| DB | 옵션 단위 매핑 테이블 + 다중 크레딧 적립 함수 | `supabase/migrations/040_naver_option_grants.sql` |
| DB | 옵션→크레딧 시드 | `supabase/migrations/041_naver_option_grants_seed.sql` |
| 서버 | 커머스 API 토큰 서명을 bcrypt 로 교정 (`bcryptjs` 추가) | `src/lib/naver/smartstore.ts` |
| 서버 | 주문 상세에서 `optionCode`/`optionManageCode`/`productOption` 캡처 | `src/lib/naver/smartstore.ts` |
| 서버 | 커머스 API 호출을 고정 IP 프록시 경유 지원 (`undici` 추가) | `src/lib/naver/smartstore.ts` |
| 서버 | 등록 라우트를 옵션 기반 적립으로 교체 | `src/app/api/orders/register/route.ts` |
| 타입 | `grant_smartstore_order` RPC 타입 추가 | `src/types/database.ts` |
| 문서 | 환경변수 `NAVER_COMMERCE_PROXY` 안내 | `.env.local.example` |

### 동작 흐름 (적립)
```
손님이 마이페이지 [주문] 탭에 상품주문번호 입력
   → /api/orders/register
   → (커머스 API 미설정 시 503 "연동 준비 중")
   → 커머스 API 로 상품주문 조회: productId(상품번호) + optionCode(옵션)
   → grant_smartstore_order(상품번호, 옵션코드)
   → naver_option_grants 매핑대로 발행권/영구소장/스냅/재생성 동시 적립
   → 멱등(상품주문번호당 1회) · 미매핑 옵션은 422 안내
```

---

## 2. 배포 순서 ⚠️ (이 순서를 지킬 것)

> 핵심 원칙: **DB 마이그레이션 먼저, 소스 배포 나중.**
> 새 소스는 `grant_smartstore_order` 함수를 호출하므로, 함수가 DB 에 없으면
> 주문 등록이 실패한다. 마이그레이션을 먼저 적용하면 기존(구) 소스는 그대로
> 동작하고(시그니처 동일), 새 함수는 소스 배포 전까지 그냥 대기 상태로 남는다.

### 2-0. (필수) 사전 점검 — 운영 DB 의 purchase_orders 컬럼 확인
`039` 는 `grant_purchase_credits` 본문을 **004 의 원래 컬럼명**(`naver_order_no`,
`naver_product_order_no`, `raw_data`, `processed_at`)으로 되돌린다. 운영 DB 가
이 컬럼명을 쓰는지 먼저 확인한다. Supabase SQL Editor 에서:

```sql
select column_name
from information_schema.columns
where table_name = 'purchase_orders'
order by ordinal_position;
```

- `raw_data`, `processed_at`, `naver_product_order_no`, `naver_order_no` 가 보이면 → **그대로 진행 OK** (예상 정상 케이스).
- 만약 `raw`, `completed_at`, `naver_product_no` 같은 다른 이름이 보이면 →
  운영 스키마가 갈라진 것이니 진행 전 알려줄 것. `039`/`040` 의 INSERT 컬럼을
  맞춰 조정해야 한다.

### 2-1. DB 마이그레이션 적용
```bash
npx supabase db push
```
→ `039` → `040` → `041` 순으로 반영된다.
- `039`: 기존 멱등성/컬럼 버그 수정 (PortOne 적립에도 영향 있는 중요 수정)
- `040`: `naver_option_grants` 테이블 + `grant_smartstore_order` 함수
- `041`: 옵션→크레딧 시드 (아래 4장 표)

### 2-2. 소스 배포
PR 머지 → Vercel 자동 배포(또는 수동 Redeploy).
- 이 시점부터 등록 라우트가 옵션 기반으로 동작한다.
- **커머스 API 자격증명이 아직 없으면** 주문 등록은 `503 "네이버 스토어 연동이
  아직 준비되지 않았습니다"` 를 돌려준다(미스적립 방지). 5장 설정을 마치면
  정상 동작한다.
  - 그동안 [주문] 탭의 등록 카드를 잠시 숨기고 싶으면 알려줄 것.

### 2-3. 환경변수 (5장 설정 완료 후)
Vercel → Settings → Environment Variables:
```
NAVER_COMMERCE_CLIENT_ID   = (커머스 API 애플리케이션 ID)
NAVER_COMMERCE_CLIENT_SECRET = (시크릿, $2a$10$... 형태)
NAVER_COMMERCE_PROXY       = http://wooridaun:비밀번호@고정IP:8888
```
→ 저장 후 **Redeploy**.

---

## 3. 적립 정책 / 옵션 매핑표 (`041` 시드)

적립 수량의 단일 소스는 DB `naver_option_grants` 테이블. 수량을 바꾸려면 이
표(또는 `041`)를 수정해 다시 적용하면 된다(upsert).

### 상품 A — 알림장 (상품번호 `13622908142`) · 모든 옵션에 발행권 1 포함
| 옵션 | 옵션코드 | 발행권 | 영구소장 | 스냅 | 재생성 |
|---|---|---|---|---|---|
| 기본-알림장발행1 | 58929908992 | 1 | 0 | 0 | 0 |
| 영구소장 | 58929908993 | 1 | 1 | 0 | 0 |
| 웨딩스냅 10장(재생성2) | 58929908994 | 1 | 0 | 10 | 2 |
| 영구소장,웨딩스냅 5장(재생성1) | 58929916256 | 1 | 1 | 5 | 1 |

### 상품 B — 웨딩스냅 (상품번호 `13625481834`)
| 옵션 | 옵션코드 | 스냅 | 재생성 |
|---|---|---|---|
| 기본-5장(재생성1장) | 58930649889 | 5 | 1 |
| 10장(재생성2장) | 58930649890 | 10 | 2 |
| 20장(재생성4장) | 58930649891 | 20 | 4 |
| 40장(재생성8장) | 58935754996 | 40 | 8 |

> 옵션코드는 운영자가 판매자센터에서 전달한 값으로, 커머스 API 의
> `productOrder.optionCode` 와 매칭한다. **첫 실주문 1건으로 일치 여부를
> 반드시 검증**한다(아래 6장). 불일치 시 Vercel 로그
> `[orders/register] option not mapped` 의 실제 `option_code` 로 시드를 교정.

---

## 4. 커머스 API + 고정 IP 프록시 설정 (나중에 처리)

### 4-1. 왜 프록시가 필요한가
커머스 API 는 **"API호출 IP" 화이트리스트**가 필수다(등록한 IP 에서 온 요청만
허용). Vercel 서버리스는 고정 출발 IP 가 없으므로, **항상 켜져 있고 IP 가
고정된 중간 서버(프록시)** 를 두고 커머스 API 호출만 그 프록시를 경유시킨다.
그 프록시의 공인 IP 를 커머스 API 센터에 등록한다.

```
손님 → Vercel(IP 매번 바뀜) → [프록시: 고정 IP] → 네이버 커머스 API(허용 ✅)
```

코드는 `NAVER_COMMERCE_PROXY` 가 설정되면 토큰 발급/주문조회 호출을 자동으로
프록시 경유시킨다(`src/lib/naver/smartstore.ts`, undici ProxyAgent). 미설정이면
직접 호출.

### 4-2. 커머스 API 애플리케이션 등록
1. https://apicenter.commerce.naver.com → 판매자 계정 로그인
2. 애플리케이션 등록:
   - 애플리케이션 이름: 임의 (예: `우리다운 크레딧 적립`)
   - **API호출 IP**: 4-3 에서 만들 프록시 고정 IP (당장 등록만 하려면 임시 IP 후 교체)
   - **API 그룹: "주문 판매자" 추가** (주문조회에 필수) → "내 API 그룹" 1 이상
   - "인증 토큰 표준 스펙을 확인하였습니다" 체크
   - 등록 → **애플리케이션 ID / 시크릿** 발급 (시크릿은 `$2a$10$...` bcrypt salt)

### 4-3. 무료 고정 IP 서버 (Google Cloud Always Free, 권장)
> 무료 조건: 머신 `e2-micro` + 지역 `us-central1` + VM 계속 켜두기.

1. **VM 생성**: console.cloud.google.com → Compute Engine → VM 인스턴스 →
   인스턴스 만들기
   - 이름 `naver-proxy`, 리전 `us-central1`, 머신 `e2-micro`
   - 부팅 디스크 `Ubuntu 22.04 LTS`, 10GB → 만들기
2. **고정 IP 예약**: VPC 네트워크 → IP 주소 → 해당 VM 외부 IP 를 "고정 주소로
   예약" → IP 메모
3. **방화벽**: VPC 네트워크 → 방화벽 → 규칙 만들기
   - 이름 `allow-proxy-8888`, 수신, 대상 모든 인스턴스, 소스 `0.0.0.0/0`,
     TCP 포트 `8888`
4. **접속**: VM 인스턴스 목록에서 **[SSH]** 버튼(브라우저 터미널)
5. **프록시 설치/설정** (터미널에 복붙, 비밀번호만 교체):
   ```bash
   sudo apt update && sudo apt install -y tinyproxy
   ```
   ```bash
   sudo tee /etc/tinyproxy/tinyproxy.conf > /dev/null <<'EOF'
   User tinyproxy
   Group tinyproxy
   Port 8888
   Listen 0.0.0.0
   Timeout 600
   MaxClients 50
   StartServers 5
   LogFile "/var/log/tinyproxy/tinyproxy.log"
   LogLevel Info
   PidFile "/run/tinyproxy/tinyproxy.pid"
   BasicAuth wooridaun 바꿀비밀번호강하게
   ConnectPort 443
   FilterDefaultDeny Yes
   FilterExtended On
   Filter "/etc/tinyproxy/filter"
   EOF
   ```
   ```bash
   echo 'api\.commerce\.naver\.com' | sudo tee /etc/tinyproxy/filter > /dev/null
   sudo systemctl restart tinyproxy && sudo systemctl enable tinyproxy
   sudo systemctl status tinyproxy --no-pager
   ```
   → `active (running)` 확인.
6. **테스트** (서버 터미널, 비밀번호 교체):
   ```bash
   curl -x http://wooridaun:바꿀비밀번호강하게@127.0.0.1:8888 \
     https://api.commerce.naver.com/external/v1/oauth2/token -i
   ```
   → `400`/`401` 응답이면 연결 성공(`Connection refused` 만 아니면 OK).

> 보안: BasicAuth(인증) + `api.commerce.naver.com` 목적지로만 허용(필터)이라
> 프록시가 외부에 열려 있어도 오남용을 차단한다. 비밀번호는 강하게.

### 4-4. 네이버에 프록시 IP 등록 + Vercel 환경변수
- 커머스 API 센터 "API호출 IP" 에 프록시 고정 IP 등록(임시 IP 는 교체)
- Vercel 환경변수 3개 입력 후 Redeploy (위 2-3 참고)

---

## 5. 검증 절차
1. `npx supabase db push` 완료
2. Vercel 환경변수 설정 + Redeploy 완료
3. 스마트스토어에서 옵션 1개 실제 결제 → **상품주문번호** 확인
4. 마이페이지 → [주문] 탭 → 상품주문번호 입력 → 등록
5. 매핑대로 크레딧 적립 + 영수 메시지 확인. 주문 내역에 행 생성 확인.

---

## 6. 트러블슈팅
| 증상 | 원인/조치 |
|---|---|
| 등록 시 `네이버 스토어 연동이 아직 준비되지 않았습니다` (503) | 커머스 자격증명 미설정. 4장 완료 필요 |
| `등록되지 않은 상품 옵션입니다` (422) | 옵션코드 불일치. Vercel 로그 `option not mapped` 의 `option_code` 로 `naver_option_grants` 교정 |
| 토큰 발급 실패(서명/IP) | 시크릿이 bcrypt salt 형태인지 확인 / 프록시 IP 가 커머스 IP 화이트리스트에 등록됐는지 확인 |
| `Connection refused` (프록시 테스트) | tinyproxy 미기동 또는 방화벽(8888) 미개방 |
| 주문 조회는 되는데 적립 0 | 이미 적립된 주문(멱등). 정상 |

---

## 7. 참고
- 로그인은 네이버 OAuth 단독 (`src/app/api/auth/naver/*`). 카카오는 주석 처리.
- 적립 함수는 두 갈래: PortOne 결제 → `grant_purchase_credits`(basic),
  스마트스토어 → `grant_smartstore_order`(옵션 매핑).
- 적립 수량 단일 소스: `naver_option_grants` 테이블.
