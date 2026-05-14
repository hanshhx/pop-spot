<div align="center">

# POP-SPOT

성수동 팝업스토어 검색 · 자동수집 · 음악 매칭 서비스

🌐 **[popspot.co.kr](https://popspot.co.kr/)**

[![Java](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring](https://img.shields.io/badge/Spring_Boot-4.0-6DB33F?logo=springboot&logoColor=white)](https://spring.io/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Groq](https://img.shields.io/badge/Groq_LLM-llama3.3_70B-F55036)](https://groq.com/)

</div>

---

## 🏗️ Architecture

<table align="center">
  <tr>
    <th width="170" align="center">User</th>
    <th width="30" align="center"></th>
    <th width="170" align="center">Frontend</th>
    <th width="30" align="center"></th>
    <th width="170" align="center">Edge</th>
    <th width="30" align="center"></th>
    <th width="170" align="center">Backend</th>
  </tr>
  <tr>
    <td align="center">
      <img src="https://cdn.simpleicons.org/googlechrome/4285F4" width="44"/><br/>
      <b>Browser</b><br/>
      <sub>Web · Mobile</sub>
    </td>
    <td align="center">→</td>
    <td align="center">
      <img src="https://cdn.simpleicons.org/nextdotjs/000000" width="44"/><br/>
      <b>Next.js 14</b><br/>
      <sub>Vercel · Tailwind</sub>
    </td>
    <td align="center">→</td>
    <td align="center">
      <img src="https://cdn.simpleicons.org/tailscale/242424" width="44"/><br/>
      <b>Tailscale Funnel</b><br/>
      <sub>HTTPS · Free</sub>
    </td>
    <td align="center">→</td>
    <td align="center">
      <img src="https://cdn.simpleicons.org/springboot/6DB33F" width="44"/><br/>
      <b>Spring Boot</b><br/>
      <sub>Java 21 · STOMP</sub>
    </td>
  </tr>
</table>

<table align="center">
  <tr>
    <th colspan="6" align="center">💾 Data Layer</th>
  </tr>
  <tr>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/postgresql/4169E1" width="40"/><br/>
      <b>PostgreSQL</b><br/>
      <sub>팝업·유저·주문</sub>
    </td>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/redis/DC382D" width="40"/><br/>
      <b>Redis</b><br/>
      <sub>인증 TTL · Rate Limit</sub>
    </td>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/algolia/003DFF" width="40"/><br/>
      <b>Algolia</b><br/>
      <sub>한글 검색</sub>
    </td>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/sentry/362D59" width="40"/><br/>
      <b>Sentry</b><br/>
      <sub>에러 모니터링</sub>
    </td>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/flyway/CC0200" width="40"/><br/>
      <b>Flyway</b><br/>
      <sub>스키마 마이그레이션</sub>
    </td>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/prometheus/E6522C" width="40"/><br/>
      <b>Micrometer</b><br/>
      <sub>JVM 메트릭</sub>
    </td>
  </tr>
</table>

<table align="center">
  <tr>
    <th colspan="6" align="center">🌍 External APIs</th>
  </tr>
  <tr>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/spotify/1DB954" width="38"/><br/>
      <b>Spotify</b><br/>
      <sub>곡 검색</sub>
    </td>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/youtube/FF0000" width="38"/><br/>
      <b>YouTube</b><br/>
      <sub>IFrame · Suggest</sub>
    </td>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/naver/03C75A" width="38"/><br/>
      <b>Naver Search</b><br/>
      <sub>Blog · News</sub>
    </td>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/kakao/FFCD00" width="38"/><br/>
      <b>Kakao</b><br/>
      <sub>Search · Local</sub>
    </td>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/openai/412991" width="38"/><br/>
      <b>Groq LLM</b><br/>
      <sub>정규화 · 무드</sub>
    </td>
    <td width="160" align="center">
      <img src="https://cdn.simpleicons.org/stripe/635BFF" width="38"/><br/>
      <b>Iamport</b><br/>
      <sub>결제 · 검증</sub>
    </td>
  </tr>
</table>

<table align="center">
  <tr>
    <th colspan="4" align="center">🔐 Backend Internals</th>
  </tr>
  <tr>
    <td width="220" align="center">
      <b>🛡️ Security</b><br/>
      <sub>JWT (HS256 · 32B+)<br/>OAuth2 (Google · Kakao · Naver)<br/>BCrypt 12 · CORS Allowlist</sub>
    </td>
    <td width="220" align="center">
      <b>🚦 Rate Limit</b><br/>
      <sub>Bucket4j<br/>로그인 5/min<br/>이메일 5/h</sub>
    </td>
    <td width="220" align="center">
      <b>⏰ Schedulers</b><br/>
      <sub>04:00 · 자동수집<br/>05:00 · 만료 처리</sub>
    </td>
    <td width="220" align="center">
      <b>🔌 WebSocket</b><br/>
      <sub>STOMP<br/>채팅 · 일정 협업</sub>
    </td>
  </tr>
</table>

---

## 🕷️ 자동수집 (V4)

<table align="center">
<tr>
<td align="center" width="110">
  <b>⏰ Cron 04:00</b><br/><sub>매일 KST</sub>
</td>
<td align="center">→</td>
<td align="center" width="170">
  <img src="https://cdn.simpleicons.org/naver/03C75A" width="28"/>
  <img src="https://cdn.simpleicons.org/kakao/FFCD00" width="28"/><br/>
  <b>검색 API</b><br/><sub>title/desc/link</sub>
</td>
<td align="center">→</td>
<td align="center" width="170">
  <img src="https://cdn.simpleicons.org/openai/412991" width="28"/><br/>
  <b>LLM 정규화</b><br/><sub>+ confidence</sub>
</td>
<td align="center">→</td>
<td align="center" width="170">
  <img src="https://cdn.simpleicons.org/postgresql/4169E1" width="28"/><br/>
  <b>DB 저장</b><br/><sub>≥0.8 자동게시</sub>
</td>
</tr>
</table>

> 본문 스크래핑 X — 검색 API 가 주는 title/desc/link 만 사용 (저작권법 §35의5 공정이용)

---

## 🎵 음악 → 팝업 매칭

<table align="center">
<tr>
<td align="center" width="130">
  <b>🎵 곡 클릭</b>
</td>
<td align="center">→</td>
<td align="center" width="170">
  <img src="https://cdn.simpleicons.org/spotify/1DB954" width="28"/><br/>
  <b>Spotify</b><br/><sub>5단 한국어 폴백</sub>
</td>
<td align="center">→</td>
<td align="center" width="170">
  <img src="https://cdn.simpleicons.org/openai/412991" width="28"/><br/>
  <b>무드 분석</b><br/><sub>40개 화이트리스트</sub>
</td>
<td align="center">→</td>
<td align="center" width="150">
  <b>🎁 팝업 5개</b><br/><sub>카테고리 매칭</sub>
</td>
</tr>
</table>

> 재생은 YouTube IFrame (약관 III.E.4.b — 영상 화면 노출 필요)

---

## 📈 버전별 진화

| 버전 | 시기 | 핵심 변화 |
|:---:|:---:|---|
| **v1.0** | 2024 가을 | AWS EC2 + 모놀리식. 시크릿 하드코딩 / CORS \* / H2 in-memory |
| **v1.1** | 2025 봄 |  OWASP Top 10 적용 (시크릿 환경변수 · JWT 32B · Rate Limit · BCrypt 12) <br/> Gemini → **Groq** (200/일 → 14,400/일, 약 72배) |
| **v1.2** | 2025 5월 |  GCP → **Proxmox VM** (집 서버, 월 0원) <br/> nginx + certbot → **Tailscale Funnel** (HTTPS 자동) |
| **v1.3** | 2026 1~4월 |  음악 시스템 풀세트 (Spotify + YouTube + 무드 + 글로벌 플레이어) <br/> 자동수집 V4 (Naver/Kakao + LLM + confidence 분기) <br/> 등급 시스템 (BEGINNER / HUNTER / MASTER) |
| **v1.4** | 2026 5월 |  백엔드 Clean Code 7 Wave (48 파일) <br/> Spotless `googleJavaFormat aosp` <br/>외부 동작 100% 동일, 내부 구조만 정리 |

---

##  폴더 구조 (백엔드)

```
popspot-backend/
├── src/main/java/com/example/popspotbackend/
│   ├── controller/     ← 25 (REST + STOMP)
│   ├── service/
│   │   ├── (root)      ← 16 일반 비즈니스 로직
│   │   ├── music/      ← 7 음악 매칭
│   │   └── crawler/    ← 8 자동수집
│   ├── entity/         ← 13 JPA
│   ├── repository/     ← 15 Spring Data JPA
│   ├── dto/            ← ~25 요청/응답
│   ├── config/         ← 9 Security/WS/RateLimit/AI
│   └── exception/      ← GlobalExceptionHandler
├── src/main/resources/db/migration/   ← Flyway
└── build.gradle        ← Spotless 적용
```

---

## 🐛 트러블슈팅 (재밌었던 것만)

| # | 문제 | 해결 |
|:--:|---|---|
| 1 | `LazyInitializationException` 갑자기 터짐 | EAGER → LAZY + fetch join |
| 2 | PostgreSQL ILIKE 한글 검색 3초 | Algolia 붙여서 200ms |
| 3 | Spotify 가 "아이유 좋은날" 못 찾음 | Groq 로 영문 표기 변환 ("IU good day") |
| 4 | application-prod.properties 우선순위 함정 | 외부 파일 → 환경변수만 사용 |
| 5 | Gemini 키 GitHub 노출 → 자동 차단 | 시크릿 스캔 GitHub Action 추가 |

---

##  TODO

- [ ] iOS / Android 네이티브 (Capacitor 검토)
- [ ] 팝업 이미지 OCR — 자동수집 정확도 더 올리기
- [ ] AI 어시스턴트 — 사용자 취향 학습
- [ ] 단위 테스트 커버리지 50%+ (지금 10%)
- [ ] 시놀로지 NAS 이전 마무리

---

##  만든 사람

**동현** · 디자인 도움 [@hanshhx](https://github.com/hanshhx)



문의 / 버그 제보는 GitHub Issues 로.

<div align="center">
<sub>Made with ☕ in Seoul</sub>
</div>
