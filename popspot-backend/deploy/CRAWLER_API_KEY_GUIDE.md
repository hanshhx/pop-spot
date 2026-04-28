# 팝업스토어 자동수집용 API 키 발급 가이드

POP-SPOT 의 자동수집(Tier 1) 은 **공식 검색 API 만** 사용합니다.
인스타그램/네이버블로그 본문 직접 크롤링 같은 회색지대 수집은 일절 없으며,
모든 데이터는 검색 API 가 반환하는 title/description/link 만 사용합니다.

---

## 1. 네이버 검색 API (필수)

### 발급 절차

1. https://developers.naver.com 접속 → 로그인 (네이버 계정)
2. 상단 **Application → 애플리케이션 등록** 클릭
3. 폼 입력:
   - 애플리케이션 이름: `POP-SPOT 팝업스토어 큐레이션`
   - 사용 API: **검색** 체크
   - 비로그인 오픈 API 서비스 환경:
     - **WEB 설정** 추가
     - 웹 서비스 URL: `https://popspot.co.kr`
4. 등록 → "내 애플리케이션" 탭에서 **Client ID / Client Secret** 확인

### 무료 한도

- 검색 API: **하루 25,000회**
- 우리 자동수집은 키워드 7개 × 검색 4종 × 1일 1회 = **하루 28회 호출** → 한도의 0.1% 사용
- 사실상 무료

### .env 등록

```env
NAVER_CLIENT_ID=발급받은_Client_ID
NAVER_CLIENT_SECRET=발급받은_Client_Secret
```

(이미 OAuth2 로그인용으로 같은 키를 쓰고 있으므로 재사용 가능)

### 약관 준수 사항

- 검색 결과 표시 시 **출처 명시 필수** (응답에 `link` 필드 포함됨 → 프론트에서 "원문 보기" 링크 표시)
- 본문 크롤링 금지 (우리는 스니펫만 사용 → 위반 아님)
- 일일 한도 초과 시 자동 차단 → 우리 사용량으로는 도달 불가

---

## 2. 카카오 검색 API (필수)

### 발급 절차

1. https://developers.kakao.com 접속 → 로그인 (카카오 계정)
2. 상단 **내 애플리케이션 → 애플리케이션 추가하기**
3. 폼 입력:
   - 앱 이름: `POP-SPOT`
   - 사업자명: 본인 이름 또는 사업자명
4. 생성된 앱 클릭 → **앱 키** 메뉴
5. **REST API 키** 복사 (이게 우리가 쓸 키)

### 추가 설정

- **앱 설정 → 플랫폼 → Web 플랫폼 등록**
  - 사이트 도메인: `https://popspot.co.kr`, `https://popspot.duckdns.org`

### 무료 한도

- 검색 API: **하루 30,000회**
- 우리 사용량: 동일 (28회/일) → 0.1% 사용

### .env 등록

```env
KAKAO_REST_API_KEY=발급받은_REST_API_키
```

(이미 카카오맵 등에 같은 키를 쓰고 있으면 그대로 재사용)

### 약관 준수 사항

- 위와 동일: title/contents/url 만 사용, 출처 표시, 본문 크롤링 금지

---

## 3. Gemini API 키 (이미 있음)

자동수집 결과를 구조화하는 데 LangChain4j + Gemini 사용.
이미 발급된 `GEMINI_API_KEY` 그대로 사용. 추가 발급 불필요.

---

## 4. 로컬 테스트 절차

API 키 등록 후 동작 확인:

```bash
# 1) 백엔드 부팅 (개발 모드, crawler 기본 OFF)
./gradlew bootRun

# 2) admin 토큰 받기 (관리자 계정으로 로그인)
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@popspot.co.kr","password":"..."}' | jq -r .accessToken)

# 3) 수동 크롤 1회 실행
curl -X POST http://localhost:8080/api/admin/popups/crawl/run \
  -H "Authorization: Bearer $TOKEN"

# 응답 예시:
# {
#   "triggeredAt": "2026-04-28T15:00:00",
#   "stats": {
#     "totalSnippets": 420,
#     "normalized": 7,
#     "autoPublished": 5,
#     "pendingReview": 2,
#     "duplicates": 0,
#     "rejected": 0
#   }
# }

# 4) 캘린더 확인 (오늘 ~ 60일 후)
curl http://localhost:8080/api/popups/calendar | jq

# 5) 검수 큐 확인
curl http://localhost:8080/api/admin/popups/pending \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 5. 운영 활성화 절차

VM 의 `/etc/popspot/popspot.env` 에서:

```env
POPSPOT_CRAWLER_ENABLED=true
POPSPOT_CRAWLER_CONFIDENCE=0.8
POPSPOT_CRAWLER_CRON=0 0 4 * * *
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
KAKAO_REST_API_KEY=...
```

다음 systemd 재시작 후 매일 새벽 4시(KST) 자동 실행됩니다.

---

## 6. 법적 안전장치 체크리스트

- [x] 공식 API 만 사용 (TOS 위반 없음)
- [x] 본문 직접 크롤링 없음
- [x] 모든 row 에 `source_url` 저장 → 프론트에 출처 링크 노출
- [x] 신뢰도 < 0.8 은 admin 검수 큐로 → 자동 노출 안 함
- [x] 권리자 takedown 신고 → 즉시 노출 차단 (`POST /api/popups/{id}/takedown`)
- [x] 약관에 자동수집 + takedown 절차 명시 (TERMS_OF_SERVICE_CLAUSE.md)
- [x] User-Agent 명시 (`popspot-crawler/1.0`)
- [x] API 호출 사이 800ms 딜레이 (rate limit 방어)
