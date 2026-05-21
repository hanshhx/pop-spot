<div align="center">

# POP-SPOT

성수동 팝업스토어 검색 · 자동수집 · 음악 매칭 서비스

**[popspot.co.kr](https://popspot.co.kr/)**

[![Java](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring](https://img.shields.io/badge/Spring_Boot-4.0-6DB33F?logo=springboot&logoColor=white)](https://spring.io/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-6-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Groq](https://img.shields.io/badge/Groq_LLM-llama3.3_70B-F55036)](https://groq.com/)

</div>

---

## Architecture

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
      <b>Next.js 16</b><br/>
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
    <th colspan="5" align="center">Data Layer</th>
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
    <th colspan="5" align="center">External APIs</th>
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
  </tr>
</table>

<table align="center">
  <tr>
    <th colspan="4" align="center">Backend Internals</th>
  </tr>
  <tr>
    <td width="220" align="center">
      <b>Security</b><br/>
      <sub>JWT (HS256 · 32B+)<br/>OAuth2 (Google · Kakao · Naver)<br/>BCrypt 12 · CORS Allowlist</sub>
    </td>
    <td width="220" align="center">
      <b>Rate Limit</b><br/>
      <sub>Bucket4j<br/>로그인 5/min<br/>이메일 5/h</sub>
    </td>
    <td width="220" align="center">
      <b>Schedulers</b><br/>
      <sub>04:00 · 자동수집<br/>05:00 · 만료 처리</sub>
    </td>
    <td width="220" align="center">
      <b>WebSocket</b><br/>
      <sub>STOMP<br/>채팅 · 일정 협업</sub>
    </td>
  </tr>
</table>

---

## 자동수집 (V4)

<table align="center">
<tr>
<td align="center" width="110">
  <b>Cron 04:00</b><br/><sub>매일 KST</sub>
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

**규모** — 매일 60 키워드 × (Naver 블로그·뉴스 + Kakao 웹·블로그 각 30건) · 호출 간 800 ms · LLM 호출 간 2.2 초 (RPM 30 활용) · 풀크롤 약 5 분.
**중복 제거** — `external_id = SHA-256(name+loc+date)` 유니크 인덱스. confidence ≥ 0.8 자동 게시, 미만은 admin 검수 큐.

**7대 운영 안전장치**

1. **TOS** — 공식 검색 API 만, User-Agent 명시, 일일 한도 1% 미만, 800 ms 간격
2. **저작권** — snippet + source_url 만 저장, AI paraphrase, 이미지 직접 호스팅 X
3. **개인정보** — LLM 프롬프트에서 PII (휴대폰·이메일·실명·닉네임) 제외 + 약관 §13
4. **정확성 면책** — 신뢰도 점수 · AI 뱃지 · Footer 안내 · 약관 §10③
5. **Takedown** — 24h SLA · 즉시 차단 · `POST /api/popups/{id}/takedown` · 약관 §11
6. **만료 자동처리** — 매일 05:00 KST 에 `end_date < today` 일괄 `EXPIRED`
7. **약관 가시성** — `/terms` 페이지 + Footer 링크 + 가입 동의 체크

---

## 음악 → 팝업 매칭

<table align="center">
<tr>
<td align="center" width="130">
  <b>곡 클릭</b>
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
  <b>팝업 5개</b><br/><sub>카테고리 매칭</sub>
</td>
</tr>
</table>

> 재생은 YouTube IFrame (약관 III.E.4.b — 영상 화면 노출 필요)

---

## 주요 기능

| 영역 | 기능 |
|---|---|
| **진입** | `/intro` 풀스크린 스크롤 스냅 + 영상 배경 (middleware 강제 리다이렉트) |
| **음악 검색·재생** | Spotify Web API · 한국어 5단계 폴백 (Groq 영문 변환) · YouTube IFrame 풀 재생 · lazy fetch + 영구 캐시 (quota 10,000/day 보호) |
| **음악 매칭** | Groq 무드 분석 40 화이트리스트 → 30점 키워드 + 카테고리 보너스 → 상위 5개 팝업 반환 (외부 호출 0회, DB 만) |
| **음악 보조** | 운명의 곡 룰렛 (`POST /api/music/roulette`) · 자동 다음 곡 큐 · 음악 패스포트 (`/music/passport` 청취 기록+통계) · 카테고리 라이브러리 10종 |
| **글로벌 플레이어** | Provider 패턴 — 라우트 이동에도 재생·큐 유지 (root layout) |
| **검색 자동완성** | BFF 프록시 (Spring 인코딩 함정 3종 우회) + 디바운스/키보드 네비 |
| **팝업 자동수집 V4** | Naver/Kakao 검색 API → Groq 정규화 → confidence ≥ 0.8 자동 게시 |
| **지도** | Kakao Local API geocoding → lat/lng |
| **등급** | BEGINNER (3) · HUNTER (6) · MASTER (12) — PASSPORT 아바타 ring + RankCard 진행도 |
| **실시간** | STOMP — `/ws-stomp` 채팅 · `/ws-planning` 일정 협업 |
| **운영** | Takedown 24h SLA · `/terms` 약관 · 7대 정책 안전장치 · graceful fallback |

---

## 버전별 시스템 아키텍처

각 버전이 어떻게 생겼었고, 다음 버전에서 무엇이 잘려나갔는지 그림으로 정리한다.
아키텍처가 바뀌지 않은 항목은 표기하지 않았다.

<br/>

### v1.0 — 첫 배포

> 학부 캡스톤 과제. 가입 / 로그인 / 팝업 조회만 돌면 됐다. GCP VM + Oracle + Gemini, 시크릿 평문 커밋, CORS `*`, JWT `"default_secret"`. v1.1 에서 한꺼번에 갚게 된 빚.

<table align="center">
  <tr>
    <td align="center" width="110">
      <img src="https://cdn.simpleicons.org/googlechrome/4285F4" width="34"/><br/>
      <b>Browser</b>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/vercel/000000" width="34"/><br/>
      <b>Vercel</b><br/>
      <sub>Next.js</sub>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/googlecloud/4285F4" width="34"/><br/>
      <b>GCP Compute Engine</b><br/>
      <sub>Spring Boot</sub>
    </td>
    <td align="center" width="20">+</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/oracle/F80000" width="34"/><br/>
      <b>Oracle DB</b><br/>
      <sub>Sequence 수동</sub>
    </td>
    <td align="center" width="20">+</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/googlegemini/8E75B2" width="34"/><br/>
      <b>Gemini</b><br/>
      <sub>정규화</sub>
    </td>
  </tr>
</table>

<sub>GCP VM + Oracle + Gemini Free (RPM 10) · BCrypt 10 · 8080 직접 노출.</sub>

<br/>

### v1.1 — 보안 정비 + AI 교체

> v1.0 의 빚을 한 번에 갚았다.
> - 시크릿 전부 환경변수로 빼고 누락 시 부팅 실패
> - JWT 32B 이상 강제, CORS 화이트리스트, BCrypt 12, Bucket4j Rate Limit
> - 결제 검증을 서버 측 PortOne 재조회로 전환
> - Oracle → PostgreSQL (SEQUENCE 수동 제거, IDENTITY 자동)
> - Gemini → Groq (Free 한도 부족 + 키 노출로 quota 0 사고)

<table align="center">
  <tr>
    <td align="center" width="110">
      <img src="https://cdn.simpleicons.org/googlechrome/4285F4" width="34"/><br/>
      <b>Browser</b>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/vercel/000000" width="34"/><br/>
      <b>Vercel</b><br/>
      <sub>Next.js</sub>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/nginx/009639" width="34"/><br/>
      <b>nginx</b><br/>
      <sub>+ Let's Encrypt</sub>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/googlecloud/4285F4" width="34"/><br/>
      <b>GCP VM</b><br/>
      <sub>Spring Boot</sub>
    </td>
    <td align="center" width="20">+</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/postgresql/4169E1" width="30"/>
      <img src="https://cdn.simpleicons.org/redis/DC382D" width="30"/><br/>
      <b>Postgres · Redis</b>
    </td>
  </tr>
</table>

<table align="center">
  <tr>
    <th align="center" width="140">분류</th>
    <th align="center" width="240">v1.0</th>
    <th align="center" width="240">v1.1</th>
  </tr>
  <tr>
    <td align="center"><b>DB</b></td>
    <td align="center">Oracle (Sequence 수동)</td>
    <td align="center">PostgreSQL <code>IDENTITY</code> + Flyway</td>
  </tr>
  <tr>
    <td align="center"><b>시크릿</b></td>
    <td align="center">하드코딩 · 깃 커밋</td>
    <td align="center"><code>${ENV:}</code>, 누락 시 부팅 실패</td>
  </tr>
  <tr>
    <td align="center"><b>JWT</b></td>
    <td align="center"><code>default_secret</code></td>
    <td align="center">HS256 · 32B+ 강제</td>
  </tr>
  <tr>
    <td align="center"><b>CORS</b></td>
    <td align="center"><code>*</code></td>
    <td align="center">패턴 화이트리스트</td>
  </tr>
  <tr>
    <td align="center"><b>Rate Limit</b></td>
    <td align="center">없음</td>
    <td align="center">Bucket4j</td>
  </tr>
  <tr>
    <td align="center"><b>BCrypt</b></td>
    <td align="center">strength 10</td>
    <td align="center">strength 12</td>
  </tr>
  <tr>
    <td align="center"><b>결제</b></td>
    <td align="center">클라 검증만</td>
    <td align="center">서버 재검증 + 자동 환불</td>
  </tr>
  <tr>
    <td align="center"><b>관측</b></td>
    <td align="center">없음</td>
    <td align="center">Sentry · Micrometer</td>
  </tr>
  <tr>
    <td align="center"><b>AI</b></td>
    <td align="center">Gemini Free (RPM 10)</td>
    <td align="center">Groq llama-3.3-70b (RPM 30)</td>
  </tr>
</table>

<br/>

### v1.2 — 집서버 이전 + nginx 제거

> GCP Free Tier 만료 예정 → 친구 NAS 의 Proxmox VE / Ubuntu VM 으로 이전. 호스팅 비용 0원.
> nginx + certbot 대신 Tailscale Funnel 한 줄로 HTTPS 자동 발급·갱신.
> Docker 없이 systemd + `start.sh` 유지 — 디버깅 단순.

<table align="center">
  <tr>
    <td align="center" width="110">
      <img src="https://cdn.simpleicons.org/googlechrome/4285F4" width="34"/><br/>
      <b>Browser</b>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/vercel/000000" width="34"/><br/>
      <b>Vercel</b><br/>
      <sub>Next.js</sub>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/tailscale/242424" width="34"/><br/>
      <b>Tailscale Funnel</b><br/>
      <sub>HTTPS 자동</sub>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="160">
      <img src="https://cdn.simpleicons.org/proxmox/E57000" width="30"/>
      <img src="https://cdn.simpleicons.org/ubuntu/E95420" width="30"/><br/>
      <b>Proxmox / Ubuntu VM</b><br/>
      <sub>친구 시놀로지 NAS</sub>
    </td>
    <td align="center" width="20">+</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/springboot/6DB33F" width="30"/>
      <img src="https://cdn.simpleicons.org/postgresql/4169E1" width="30"/>
      <img src="https://cdn.simpleicons.org/redis/DC382D" width="30"/><br/>
      <sub>Boot · PG · Redis</sub>
    </td>
  </tr>
</table>

<table align="center">
  <tr>
    <th align="center" width="140">분류</th>
    <th align="center" width="240">v1.1</th>
    <th align="center" width="240">v1.2</th>
  </tr>
  <tr>
    <td align="center"><b>호스팅</b></td>
    <td align="center">GCP VM (월 ~$30)</td>
    <td align="center">친구 NAS · Proxmox · Ubuntu (월 0원)</td>
  </tr>
  <tr>
    <td align="center"><b>외부 노출</b></td>
    <td align="center">nginx + certbot</td>
    <td align="center">Tailscale Funnel 한 줄</td>
  </tr>
  <tr>
    <td align="center"><b>도메인</b></td>
    <td align="center">popspot.duckdns.org</td>
    <td align="center">vm-113.tailc57dd4.ts.net · popspot.co.kr</td>
  </tr>
  <tr>
    <td align="center"><b>배포</b></td>
    <td align="center"><code>start.sh + nohup</code></td>
    <td align="center">systemd <code>EnvironmentFile</code></td>
  </tr>
  <tr>
    <td align="center"><b>스택</b></td>
    <td align="center">Spring Boot 3.x · PG 14</td>
    <td align="center">Spring Boot 4.0.2 · PG 14 · Redis 6</td>
  </tr>
</table>

<br/>

### v1.3 — 음악·자동수집·등급

> 결제 페이지 폐기, 음악 매칭을 코어 가치로 전환.
> - **음악 검색** — Spotify Web API + Groq 영문 변환 5단계 폴백
> - **음악 재생** — YouTube IFrame 풀곡, 영구 캐시로 quota 절약
> - **무드 매칭** — Groq 가 40 화이트리스트 안에서 5개만 고르도록 강제 → 결정적 매칭, 외부 호출 0
> - **자동수집 V4** — 매일 04:00, Naver/Kakao 검색 API + Groq 정규화, confidence ≥ 0.8 자동 게시
> - **지오코딩** — Kakao Local API 로 lat/lng
> - **등급** — BEGINNER (3) / HUNTER (6) / MASTER (12)

<table align="center">
  <tr>
    <td align="center" width="110">
      <img src="https://cdn.simpleicons.org/googlechrome/4285F4" width="34"/><br/>
      <b>Browser</b>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/vercel/000000" width="34"/><br/>
      <b>Vercel</b><br/>
      <sub>Next.js 16</sub>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/tailscale/242424" width="34"/><br/>
      <b>Tailscale</b><br/>
      <sub>Funnel</sub>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/springboot/6DB33F" width="34"/><br/>
      <b>Spring Boot 4</b><br/>
      <sub>STOMP · 04:00 cron</sub>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/postgresql/4169E1" width="30"/>
      <img src="https://cdn.simpleicons.org/redis/DC382D" width="30"/><br/>
      <sub>PG · Redis</sub>
    </td>
  </tr>
  <tr>
    <td colspan="9" align="center">
      <br/>
      <sub><b>서비스 레이어 (신규)</b></sub><br/>
      <img src="https://cdn.simpleicons.org/spotify/1DB954" width="26" title="Spotify"/> &nbsp;
      <img src="https://cdn.simpleicons.org/youtube/FF0000" width="26" title="YouTube IFrame"/> &nbsp;
      <img src="https://cdn.simpleicons.org/naver/03C75A" width="26" title="Naver Search"/> &nbsp;
      <img src="https://cdn.simpleicons.org/kakao/FFCD00" width="26" title="Kakao Search · Local"/> &nbsp;
      <img src="https://cdn.simpleicons.org/openai/412991" width="26" title="Groq LLM"/>
    </td>
  </tr>
</table>

<table align="center">
  <tr>
    <th align="center" width="140">영역</th>
    <th align="center" width="240">v1.2</th>
    <th align="center" width="240">v1.3</th>
  </tr>
  <tr>
    <td align="center"><b>메인 가치</b></td>
    <td align="center">팝업 + PortOne 결제</td>
    <td align="center">팝업 + <b>음악 → 팝업 매칭</b></td>
  </tr>
  <tr>
    <td align="center"><b>음악 검색</b></td>
    <td align="center">없음</td>
    <td align="center">Spotify + Groq 5단계 폴백</td>
  </tr>
  <tr>
    <td align="center"><b>음악 재생</b></td>
    <td align="center">없음</td>
    <td align="center">YouTube IFrame + 영구 캐시</td>
  </tr>
  <tr>
    <td align="center"><b>매칭 알고리즘</b></td>
    <td align="center">없음</td>
    <td align="center">Groq 40 화이트리스트 + 키워드/카테고리 점수</td>
  </tr>
  <tr>
    <td align="center"><b>자동수집</b></td>
    <td align="center">없음</td>
    <td align="center">V4 — 검색 API + Groq, confidence ≥ 0.8 자동 게시</td>
  </tr>
  <tr>
    <td align="center"><b>지오코딩</b></td>
    <td align="center">없음</td>
    <td align="center">Kakao Local API</td>
  </tr>
  <tr>
    <td align="center"><b>스케줄러</b></td>
    <td align="center">없음</td>
    <td align="center">04:00 수집 · 05:00 만료 (KST)</td>
  </tr>
  <tr>
    <td align="center"><b>리워드</b></td>
    <td align="center">확성기 소모성</td>
    <td align="center">BEGINNER / HUNTER / MASTER</td>
  </tr>
  <tr>
    <td align="center"><b>DB 마이그레이션</b></td>
    <td align="center">V1~V3</td>
    <td align="center">V4 · V5 · V6 (popup +11 · music_track · spotify_track_id)</td>
  </tr>
</table>

<br/>

### v1.4 — 백엔드 Clean Code 정리

> 기능 그대로, 코드만 정리. 외부 동작 100% 동일.
> - Spotless (googleJavaFormat aosp) 도입으로 자동 포맷 강제
> - 와일드카드 import 전면 제거, 인라인 코멘트 → JavaDoc 만 유지
> - 매직 넘버 `static final` 상수화, `System.out` → SLF4J
> - `processOrder()` 130줄 → 7단계 분해, `runOnce()` → 6단계
> - 7 Wave (gradle / 음악 / 크롤러 / Controller / Service / Entity / Config) + DTO·엔티티 보강
> - 70 파일 / 약 3,700 라인. API·DB 스키마·Redis 키 동등.

<table align="center">
  <tr>
    <td align="center" width="110">
      <img src="https://cdn.simpleicons.org/googlechrome/4285F4" width="34"/><br/>
      <b>Browser</b>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/vercel/000000" width="34"/><br/>
      <b>Vercel</b>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/tailscale/242424" width="34"/><br/>
      <b>Tailscale Funnel</b>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="160">
      <img src="https://cdn.simpleicons.org/springboot/6DB33F" width="34"/><br/>
      <b>Spring Boot (정리됨)</b><br/>
      <sub>Spotless · googleJavaFormat aosp</sub>
    </td>
    <td align="center" width="20">+</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/openjdk/ED8B00" width="34"/><br/>
      <b>Java 21</b>
    </td>
  </tr>
</table>

<table align="center">
  <tr>
    <th align="center" width="140">Wave</th>
    <th align="center" width="380">범위 · 핵심 변화</th>
  </tr>
  <tr>
    <td align="center"><b>Wave 1</b></td>
    <td>build.gradle — Spotless 플러그인 도입</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 2</b></td>
    <td>음악 서비스 7 파일 정리</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 3</b></td>
    <td>크롤러 8 파일 — Orchestrator / Normalization / Naver / Kakao / Scheduler 분리</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 4</b></td>
    <td>Controller 25 파일 와일드카드 import 제거</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 5</b></td>
    <td>Service 16 파일 — <code>processOrder()</code> 등 거대 메서드 분해</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 6</b></td>
    <td>Entity 핵심 6 (User, PopupStore, MatePost, Stamp, Orders, MyCourse)</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 7</b></td>
    <td>Config / Exception 9 (Security, JWT, WebSocket, RateLimit 등)</td>
  </tr>
  <tr>
    <td align="center"><b>보강</b></td>
    <td>DTO 15 + 잔여 엔티티 7 동일 원칙 적용</td>
  </tr>
</table>

<sub>Spotless 자동포맷 · 와일드카드 import 0 · 인라인 코멘트 0 · 매직 넘버 상수화 · API/DB/Redis 동등.</sub>

<br/>

### v1.5 — 프론트엔드 Clean Code 정리

> 같은 원칙을 프론트에 적용. 위험도 낮은 5 Wave (1·2·3·4·7) 만.
> - Wave 1 — 편집 흔적 마커 84건 → UI 의도 1건만 남김
> - Wave 2 — `any` 17건 → SDK 경계 1건, 도메인 타입으로 좁힘 (잠재 버그 1건 발견)
> - Wave 3 — `localhost:8080` 인라인 폴백 제거, `API_BASE_URL` 한 곳만 참조
> - Wave 4 — 매직 넘버 8건 상수화 (`SERVER_METRICS_POLL_INTERVAL_MS` 등)
> - Wave 7 — ESLint disable 8건 사유 코멘트 + `intro/page.tsx` stale closure 정공법 해결
> - Wave 5·6 (거대 컴포넌트·className) 은 E2E 셋업 후로 deferred
> - 40 파일 / ±230 라인. 외부 동작·API·WS 동등.

<table align="center">
  <tr>
    <td align="center" width="110">
      <img src="https://cdn.simpleicons.org/googlechrome/4285F4" width="34"/><br/>
      <b>Browser</b>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="160">
      <img src="https://cdn.simpleicons.org/nextdotjs/000000" width="34"/><br/>
      <b>Next.js 16 (정리됨)</b><br/>
      <sub>TypeScript strict</sub>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/tailscale/242424" width="34"/><br/>
      <b>Tailscale Funnel</b>
    </td>
    <td align="center" width="20">→</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/springboot/6DB33F" width="34"/><br/>
      <b>Spring Boot</b>
    </td>
  </tr>
</table>

<table align="center">
  <tr>
    <th align="center" width="140">Wave</th>
    <th align="center" width="380">범위 · 핵심 변화</th>
  </tr>
  <tr>
    <td align="center"><b>Wave 1</b></td>
    <td>편집 흔적 마커 84건 제거 (UI 의도 1건 유지)</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 2</b></td>
    <td><code>any</code> 17건 → SDK 1건, <code>src/types/sdk.ts</code> 로 격리</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 3</b></td>
    <td>인라인 <code>localhost:8080</code> 폴백 제거, <code>API_BASE_URL</code> 일원화</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 4</b></td>
    <td>매직 넘버 8건 상수화 (<code>SERVER_METRICS_POLL_INTERVAL_MS</code> 등)</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 7</b></td>
    <td>ESLint disable 사유 코멘트 + stale closure 정공법 해결</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 5·6</b></td>
    <td>거대 컴포넌트·className 추출은 E2E 셋업 후로 deferred</td>
  </tr>
</table>

<sub>편집 흔적 0 · `any` 0 (SDK 1 제외) · 하드코딩 URL 0 · `console.log` 0. 40 파일 / ±230 라인.</sub>

<br/>

### v1.5.1 — 빌드 검증 + 핫픽스

> Wave 2 의 타입 좁히기 직후 TS 컴파일러가 타입 불일치 16건 노출 — 사용자 화면에서 터질 뻔한 케이스를 빌드 단계에서 잡았다.
> - **잠재 버그 차단** — `targetUserId = user.userId || user.id` 가 `undefined` 면 `?userId=undefined` 로 API 호출되던 거 → empty fallback + early return
> - **이름 충돌** — lucide `User` 아이콘 ↔ 도메인 `User` 타입 alias 처리
> - **null 가드** — `User | null` 을 non-null prop 으로 넘기던 거 → JSX 가드
> - **도메인 타입 보강** — `User.id/megaphoneCount`, `PopupStore.reporterId/description/imageUrl`, `CongestionData.areaName/forecasts` optional 필드 추가
> - **인덱스 시그니처 제거** — `AdminStats` 의 `[key: string]: unknown` 으로 JSX 렌더 막히던 거 → 실제 사용 필드만 명시
> - **Recharts formatter** 시그니처 라이브러리 표준에 맞춤
> - **error 가드** — `catch (error: any)` → `instanceof Error` 분기 패턴으로 통일
> - 샌드박스 mount 캐시 NULL byte 사고 1건, admin/page.tsx 중복 닫는 태그 6줄 사고 1건 별도 수정.

<table align="center">
  <tr>
    <th align="center" width="180">패턴</th>
    <th align="center" width="400">증상 · 수정</th>
  </tr>
  <tr>
    <td align="center"><b>이름 충돌</b></td>
    <td>lucide <code>User</code> 아이콘 ↔ 도메인 <code>User</code> 타입 → alias 처리</td>
  </tr>
  <tr>
    <td align="center"><b>Null 가드</b></td>
    <td><code>User | null</code> non-null prop 통과 → JSX 가드 추가</td>
  </tr>
  <tr>
    <td align="center"><b>도메인 타입 보강</b></td>
    <td><code>User</code> · <code>PopupStore</code> · <code>CongestionData</code> optional 필드 추가</td>
  </tr>
  <tr>
    <td align="center"><b>인덱스 시그니처 제거</b></td>
    <td><code>AdminStats</code> 의 <code>[key]: unknown</code> 제거 → 실제 필드만 명시</td>
  </tr>
  <tr>
    <td align="center"><b>Recharts 시그니처</b></td>
    <td>Tooltip formatter 라이브러리 표준에 맞춤</td>
  </tr>
  <tr>
    <td align="center"><b>error 가드</b></td>
    <td><code>catch (error: any)</code> → <code>instanceof Error</code> 분기로 통일</td>
  </tr>
  <tr>
    <td align="center"><b>잠재 버그 차단</b></td>
    <td><code>?userId=undefined</code> 호출되던 거 empty fallback + early return 으로 차단</td>
  </tr>
</table>

<sub>백엔드 <code>compileJava + spotlessCheck</code> ✓ · 프론트 <code>typecheck</code> ✓ (16 → 0).</sub>

<br/>

### v1.5.2 — 백엔드 구조 개선

> 파일 안 정리(v1.4)에서 클래스 간 정리로.
> - **P1** — Controller 10개에서 Repository 직접 의존 제거. 신규 서비스 4개 (`MyPageService` · `MateService` · `ChatService` · `GoodsService`), 기존 3개 보강. `grep -r Repository controller/` 무매치 달성
> - **P2** — `ResourceNotFoundException` 도입. `RuntimeException("리소스 없음")` 30+ 곳을 도메인 예외로 격상, 400 → 404 일관화
> - **P4** — `GeocodingService` 인터페이스 + `KakaoGeocodingService` 구현 + `Coordinates` record 분리. 크롤러는 인터페이스만 의존
> - **트랜잭션 경계** — 컨트롤러 `@Transactional` 0건, Service 단위로 통일
> - `compileJava + spotlessCheck` ✓ (JDK 21). 외부 동작 변화 1건 (404 정확화), 프론트 호환 그대로.

<table align="center">
  <tr>
    <th align="center" width="180">분류</th>
    <th align="center" width="400">변경 · 효과</th>
  </tr>
  <tr>
    <td align="center"><b>P1 — Repository 디커플링</b></td>
    <td>Controller 10개 Repository 제거 + Service 4개 신규 (<code>MyPage</code> · <code>Mate</code> · <code>Chat</code> · <code>Goods</code>)</td>
  </tr>
  <tr>
    <td align="center"><b>P2 — 도메인 예외</b></td>
    <td><code>ResourceNotFoundException</code> 도입 → 400 → 404 일관화</td>
  </tr>
  <tr>
    <td align="center"><b>P4 — Geocoding 분리</b></td>
    <td><code>GeocodingService</code> 인터페이스 + Kakao 구현 + <code>Coordinates</code> record</td>
  </tr>
  <tr>
    <td align="center"><b>트랜잭션 경계</b></td>
    <td>컨트롤러 <code>@Transactional</code> 0건 → Service 단위로 통일</td>
  </tr>
  <tr>
    <td align="center"><b>중복 엔드포인트 정리</b></td>
    <td><code>MateChatController</code> 의 잘못 매핑된 <code>@DeleteMapping("/{id}")</code> 제거</td>
  </tr>
  <tr>
    <td align="center"><b>빌드 검증</b></td>
    <td><code>compileJava + spotlessCheck</code> ✓ (JDK 21)</td>
  </tr>
</table>

<sub>신규 서비스 4 + 기존 보강 3 + <code>service.geocoding/</code> 3파일 · +340 / -213 라인.</sub>

<br/>

<sub><b>실전 함정 8건 (CHANGELOG §11.9):</b> Sentry CLI Windows 차단 · SCP <code>mkdir -p</code> 누락 · 자기 자신 SSH · rebase <code>cannot lock ref</code> → <code>git rebase --quit</code> · SSH host key 프롬프트 · 마운트 캐시 truncate · LF/CRLF 경고 · 자동 배포 스크립트 템플릿.</sub>

---

<br/>

<br/>

### v1.6 — 회원가입 폼 손보기

> 베타 사용자 6명이 가입하다 막힌 부분을 모아 한 번에 정리.

<table align="center">
  <tr>
    <th align="center" width="160">항목</th>
    <th align="center" width="300">v1.5.2</th>
    <th align="center" width="300">v1.6</th>
  </tr>
  <tr>
    <td align="center"><b>비밀번호 보기</b></td>
    <td>눈 아이콘이 "현재 상태"를 표시 (가려져 있으면 닫힌 눈) — 일반 사이트와 반대라 헷갈림</td>
    <td>아이콘이 "다음 동작"을 의미 (눈 = 보기, 가려진 눈 = 가리기) — 토스/네이버와 동일</td>
  </tr>
  <tr>
    <td align="center"><b>이메일 입력</b></td>
    <td>한글 입력하면 무시되긴 했는데 사용자는 자기가 친 글자가 안 보여서 당황</td>
    <td>아예 한글 키 자체를 입력 단에서 막음. 영문/숫자/기호만 통과</td>
  </tr>
  <tr>
    <td align="center"><b>휴대전화</b></td>
    <td>"010-1234-5678" 식으로 하이픈 붙여 넣으면 유효성 검사 통과 못함</td>
    <td>붙여넣기 시 숫자가 아닌 모든 글자(하이픈·공백·괄호) 를 자동으로 제거</td>
  </tr>
  <tr>
    <td align="center"><b>생년월일</b></td>
    <td>year/month/day 3개 select 가 너비도 다르고 placeholder 도 들쭉날쭉</td>
    <td>공용 <code>BirthSelect</code> 컴포넌트로 통일 — "년 / 월 / 일" suffix 까지 동일한 룩</td>
  </tr>
  <tr>
    <td align="center"><b>데스크탑 화면</b></td>
    <td>모바일 폭(<code>max-w-[460px]</code>) 그대로 → 1920px 모니터에서 좌우 여백 ★★★★</td>
    <td>md 이상 <code>max-w-[540px]</code> 로 키움 — 데스크탑에서도 적당한 폭</td>
  </tr>
</table>

<sub>6 quick wins · <code>app/signup/page.tsx</code> 약 +80 / -45 라인.</sub>

<br/>

### v1.6.1 ~ v1.6.6 — 인트로/메인 잔손질 6건

> 첫 인상부터 매끄럽지 않다는 피드백 6건을 sub-version 으로 끊어 처리.

<table align="center">
  <tr>
    <th align="center" width="100">버전</th>
    <th align="center" width="240">v1.6</th>
    <th align="center" width="300">v1.6.6</th>
  </tr>
  <tr>
    <td align="center"><b>v1.6.1</b></td>
    <td>인트로 스크롤바가 나타나면서 콘텐츠가 살짝 왼쪽으로 점프 (CLS)</td>
    <td><code>scrollbar-gutter: stable</code> 로 스크롤바 공간을 미리 잡아둠 + 로그인/회원가입 버튼 아이콘 순서 통일</td>
  </tr>
  <tr>
    <td align="center"><b>v1.6.2</b></td>
    <td>메인의 지도/랭킹/캘린더/AI 4개 영역이 같은 배경에 떠 있어서 구분이 안 됨</td>
    <td>4개 위토 각각 흰 배경 + 그림자로 카드 블록화 — 한눈에 위토 단위가 보임</td>
  </tr>
  <tr>
    <td align="center"><b>v1.6.3</b></td>
    <td>카드를 눌러도 시각적 피드백이 없어 "눌린 건가?" 의심</td>
    <td>hover 시 살짝 확대(<code>scale-1.01</code>), 누르는 순간 살짝 축소(<code>scale-0.99</code>)</td>
  </tr>
  <tr>
    <td align="center"><b>v1.6.4</b></td>
    <td>지도에 "내 위치"를 보여줄 방법이 없음</td>
    <td>브라우저 위치 권한 받아서 파란 핀 노출 — 메모리에만 들고 있고 서버 저장 0건 (PIPA 부담 X)</td>
  </tr>
  <tr>
    <td align="center"><b>v1.6.5</b></td>
    <td>푸터에 "Twitter" 새 아이콘 (예전 파랑새) 가 그대로</td>
    <td>"X" 로고로 교체 — lucide 라이브러리에 X 가 없어서 inline SVG 직접 그림</td>
  </tr>
  <tr>
    <td align="center"><b>v1.6.6</b></td>
    <td>인트로 카피가 "혁신적인 — 똑똑한 — 새로운" 식의 딱딱한 병렬 문장</td>
    <td>"매일 새로 열리는 팝업을 한 화면에서" 처럼 회화체로. em-dash 도 제거</td>
  </tr>
</table>

<sub>6개 sub-version · 평균 50 라인/건.</sub>

<br/>

### v1.7 ~ v1.7.4 — 인트로 디자인 수정

> 디자인 자체가 AI 가 짠 듯 정형화돼있다는 피드백. SK / HM Group / Greencar / DU 70주년 레퍼런스를 분석해 매거진 무드로 갈아엎음.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v1.6.6</th>
    <th align="center" width="290">v1.7.4</th>
  </tr>
  <tr>
    <td align="center"><b>배경 시각</b></td>
    <td>글래스모피즘 카드가 모든 섹션을 도배 — 어디를 봐도 똑같은 흐릿한 유리</td>
    <td>섹션별로 컬러 후광 / outline 로고 / 폴라로이드 / bento 그리드로 시각 변화</td>
  </tr>
  <tr>
    <td align="center"><b>색 팔레트</b></td>
    <td>라임 + 핫핑크 + 보라 세 가지가 모든 페이지에 동시 등장 (시각 과부하)</td>
    <td>섹션별로 한두 컬러만 강조 + 베이스는 cream/ink 톤</td>
  </tr>
  <tr>
    <td align="center"><b>라이트/다크</b></td>
    <td>다크 모드만 디자인. 라이트 모드로 전환하면 글래스가 부자연스럽게 보임</td>
    <td>SK 톤 그라데이션 베이스 + <code>next-themes</code> 로 라이트/다크 양쪽 모두 깔끔하게</td>
  </tr>
  <tr>
    <td align="center"><b>Hero 섹션</b></td>
    <td>POP·SPOT 큰 글자 + CTA 만 띄워놓고 빈 공간이 많아 허전</td>
    <td>HM Group 식 큼지막한 outline 로고 + 플로팅 태그 4개 + Greencar 식 메타 행으로 채움</td>
  </tr>
  <tr>
    <td align="center"><b>모션 토글</b></td>
    <td>모션 줄이고 싶은 사용자 옵션 없음 — 어지러움 호소 1건</td>
    <td>우상단에 Play/Pause 토글, <code>prefers-reduced-motion</code> 자동 감지 + localStorage 저장</td>
  </tr>
</table>

<sub>5 sub-version · 인트로 전 영역 재작업.</sub>

<br/>

### v1.8 ~ v1.8.1 — 미니 위젯 프리뷰 + 파스텔 강화

> 인트로 Section 3 의 "3가지 기능" 이 텍스트만 있어서 임팩트가 약하다는 피드백.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v1.7.4</th>
    <th align="center" width="290">v1.8.1</th>
  </tr>
  <tr>
    <td align="center"><b>Section 3 (3 기능)</b></td>
    <td>아이콘 + 제목 + 설명만 있는 평범한 카드</td>
    <td>카드 안에 실제 캘린더 / 지도 / 랭킹 모양의 미니 위토 프리뷰 그림이 들어감</td>
  </tr>
  <tr>
    <td align="center"><b>Section 4 (Unique 4)</b></td>
    <td>4개 카드 디자인이 다 똑같아서 시선이 안 끌림</td>
    <td>좌측에 컬러 액센트 바 (lime/hot/violet/amber) 로 카드별 시각 차이</td>
  </tr>
  <tr>
    <td align="center"><b>다크 배경</b></td>
    <td>다크 모드 파스텔 채도가 <code>/12~15</code> 라 너무 옅어서 거의 안 보임</td>
    <td><code>/22~30</code> 로 끌어올림 — 라이트 모드 파스텔과 톤 균형</td>
  </tr>
  <tr>
    <td align="center"><b>라임 그린</b></td>
    <td><code>#c2f970</code> (lime-300) 가 라이트 모드에서 너무 밝아서 눈 아픔</td>
    <td>라이트 모드만 lime-500/600 으로 다운, 다크 모드는 그대로 — <code>text-lime-600 dark:text-lime-300</code></td>
  </tr>
</table>

<sub>2 sub-version · Section 3/4 모두 시각 차별화.</sub>

<br/>

### v1.9 — 매거진 에디토리얼 풀 리디자인

> "여백 너무 많고 임팩트 부족, 최소 10가지 적용해줘" 피드백에 맞춰 인트로 페이지를 매거진 무드로 풀 리디자인. 12개 데코 레이어 추가.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v1.8.1</th>
    <th align="center" width="290">v1.9</th>
  </tr>
  <tr>
    <td align="center"><b>여백</b></td>
    <td>섹션마다 빈 공간이 크고 한산한 느낌</td>
    <td>파스텔 orb 6개 + 그레인 텍스처 + conic ray + dust 파티클로 시각 밀도 확보</td>
  </tr>
  <tr>
    <td align="center"><b>섹션 라벨</b></td>
    <td>섹션 제목만 가운데 한 줄</td>
    <td>좌측 세로 매거진 라벨 + ghost 번호 (01/02/...) + VOL 칩으로 잡지 톤</td>
  </tr>
  <tr>
    <td align="center"><b>Hero</b></td>
    <td>POP·SPOT 한 단어 + CTA</td>
    <td>거대 outline POP·SPOT + 폴라로이드 4장 + 플로팅 마퀴 스트립</td>
  </tr>
  <tr>
    <td align="center"><b>다크 베이스</b></td>
    <td>순수 검정 <code>#0a0a0a</code> 라 너무 차가움</td>
    <td><code>#1a1820 → #221e2a</code> 따뜻한 deep purple-gray 그라데이션</td>
  </tr>
  <tr>
    <td align="center"><b>영상 배경</b></td>
    <td>17MB mp4 가 fixed 로 항상 로드 — 모바일에서 무거움</td>
    <td>영상 제거 + 파스텔 + 데코 레이어로 대체 (이 결정은 후에 v2.4 에서 재논의됨)</td>
  </tr>
</table>

<sub>12 데코 레이어 · 라이트/다크 모두 적용 · 857 라인.</sub>

<br/>

### v2.0 — 게스트 모드 + 보안 마케팅

> 상용화 직전 두 가지 마무리 — 회원가입 없이도 둘러볼 수 있게 진입 장벽 낮추기 + 백엔드에 적용된 보안 안전장치를 사용자에게 보여주기.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v1.9</th>
    <th align="center" width="290">v2.0</th>
  </tr>
  <tr>
    <td align="center"><b>비로그인 진입</b></td>
    <td>로그인 안 하면 인트로 → 로그인 페이지로 강제. 둘러볼 수가 없음</td>
    <td>첫 방문 시점을 브라우저에 기록, <b>7일 동안 게스트로 메인 둘러보기 가능</b>. 7일 후 회원가입 강제</td>
  </tr>
  <tr>
    <td align="center"><b>보안 소개</b></td>
    <td>JWT/BCrypt/CORS 등 백엔드 안전장치가 코드와 README 에만 존재. 사용자는 모름</td>
    <td><code>/about</code> 페이지에 7개 안전장치 카드 (JWT HS256 · BCrypt 12 · CORS · Rate Limit · PIPA · 24h Takedown · HTTPS) — 일반 사용자 언어로</td>
  </tr>
  <tr>
    <td align="center"><b>Footer 링크</b></td>
    <td><code>/about</code> 진입 경로 없음</td>
    <td>푸터 PLATFORM 영역에 <code>서비스 소개</code> 링크 추가</td>
  </tr>
</table>

<sub><code>src/lib/guestMode.ts</code> + <code>useGuestMode</code> 훅 + <code>app/about/page.tsx</code> 신규.</sub>

<br/>

### v2.1 ~ v2.3 — 인트로 자동 진입 실험 (전부 롤백)

> 영상처럼 자동으로 흘러가는 인트로를 두 번 시도했지만 사용자 통제권을 빼앗는 결과 → 원본 비디오 인트로로 복원.

<table align="center">
  <tr>
    <th align="center" width="100">버전</th>
    <th align="center" width="240">v2.0</th>
    <th align="center" width="280">v2.3</th>
  </tr>
  <tr>
    <td align="center"><b>v2.1</b></td>
    <td>정적 인트로 — 사용자가 직접 스크롤하며 둘러봄 (v2.0 기준)</td>
    <td>첫 방문 시 7초 동안 보여주고 자동 redirect 시도 → 사용자 "걍 자동 진입에 불과" → 폐기</td>
  </tr>
  <tr>
    <td align="center"><b>v2.2</b></td>
    <td>v2.1 의 7초 자동 redirect 방식 (이미 폐기됨)</td>
    <td>한 화면에서 5단계 자동 슬라이드 (13초) 시도 → 사용자 "오류 많고 역효과" → 폐기</td>
  </tr>
  <tr>
    <td align="center"><b>v2.3</b></td>
    <td>v2.2 의 5단계 슬라이드쇼 (이미 폐기됨)</td>
    <td><code>git show 5890365</code> 로 v1.7.3 풀스크린 비디오 + 5섹션 스냅 스크롤 인트로 복원</td>
  </tr>
</table>

<sub><b>학습:</b> 자동 전환은 사용자에게 통제권을 빼앗는다. 인트로는 보여주는 곳이 아니라 둘러보고 결정하는 곳.</sub>

<br/>

### v2.4 — 영상 토글 + 파스텔 폴백 + 메인 로고 우회 + 작전회의실 뒤로가기

> 17MB 짜리 배경 영상이 사이트 켜자마자 자동 다운로드돼 무겁다는 피드백 + 메인에서 로고 누르면 인트로가 또 떠서 두 번 들어가야 한다는 피드백 + 작전회의실 페이지에 뒤로가기 버튼이 없음 + 인트로 마지막 섹션 빨간 배경이 눈 아프다는 피드백 + 디자인이 딱딱하다는 피드백을 한 번에 정리.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v2.3</th>
    <th align="center" width="290">v2.4</th>
  </tr>
  <tr>
    <td align="center"><b>배경 영상</b></td>
    <td>17MB 짜리 배경 영상이 사이트 켤 때마다 자동 다운로드 → 모바일이나 느린 PC 에서 사이트가 버벅임</td>
    <td>기본은 영상 꺼짐 (다운로드 안 함). 우상단 토글 버튼으로 직접 켤 수 있고, 한 번 켜두면 브라우저가 기억함</td>
  </tr>
  <tr>
    <td align="center"><b>영상 OFF 시 배경</b></td>
    <td>영상 끄면 까만 배경만 보여서 밋밋함</td>
    <td>라이트 모드는 아이보리 바탕에 파스텔톤 동그란 빛 6개. 다크 모드는 따뜻한 회보라색 바탕에 같은 자리에 어두운 동그라미 6개. 두 모드 모두 배경에 <b>거대한 POP·SPOT 글씨</b>가 옅게 깔려 있음</td>
  </tr>
  <tr>
    <td align="center"><b>다크 모드 색</b></td>
    <td>거의 완전 검정에 가까워서 차가운 느낌</td>
    <td>완전 검정 대신 진한 보라-회색 톤으로 따뜻하게 (눈에 부담 ↓)</td>
  </tr>
  <tr>
    <td align="center"><b>메인 로고 클릭</b></td>
    <td>메인에서 좌상단 POP-SPOT 로고를 누르면 인트로가 다시 떠서 메인까지 두 번 들어가야 함</td>
    <td>로고를 누르면 인트로를 건너뛰고 바로 메인 유지하도록 처리</td>
  </tr>
  <tr>
    <td align="center"><b>작전회의실</b></td>
    <td>작전회의실 페이지에 뒤로가기 버튼이 없어서 메인 복귀하려면 브라우저 뒤로가기만 가능</td>
    <td>좌상단에 ← 원형 버튼 추가 — 누르면 인트로 거치지 않고 바로 메인으로 복귀</td>
  </tr>
  <tr>
    <td align="center"><b>인트로 마지막 섹션</b></td>
    <td>인트로 마지막 화면이 핫핑크 풀배경 + 흰 점박이 패턴 — 눈 아프다는 피드백</td>
    <td>강한 풀배경 제거하고 양쪽 모서리에 핑크·앰버 부드러운 빛 효과 2개로 톤다운</td>
  </tr>
  <tr>
    <td align="center"><b>섹션 라벨</b></td>
    <td>"Why POP-SPOT", "Core Features", "Only on POP-SPOT" 같은 영문 대문자 라벨이 모든 섹션에 박혀 있어 딱딱함</td>
    <td>영문 라벨 전부 제거. "Seoul Popup Store Intelligence" 같은 영문 부제도 "서울 팝업스토어 플랫폼" 으로 한글화</td>
  </tr>
</table>

<sub>4 파일 (intro/planning/header/middleware 영향) · 새 컴포넌트 <code>PastelBackground</code>, <code>GiantWordmark</code>, <code>IconButton</code> 추출.</sub>

<br/>

### v2.5 — 게스트 모드 재배선

> v2.0 에서 만들어둔 7일 게스트 모드 기능이, v2.1 ~ v2.4 인트로 리뉴얼을 거치는 동안 어느 화면에도 안 연결돼 있던 상태. 원래 의도대로 인트로 / 메인 / 회원가입 페이지에 다시 붙임.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v2.4</th>
    <th align="center" width="290">v2.5</th>
  </tr>
  <tr>
    <td align="center"><b>인트로 우상단</b></td>
    <td>로그인 / Skip 버튼만 있고 게스트 잔여 일수가 안 보임</td>
    <td>비로그인 사용자에게 라임 그린 라벨로 "게스트 D-7" ~ "D-1" 잔여일 표시 (시계 아이콘 + 마우스 올리면 설명)</td>
  </tr>
  <tr>
    <td align="center"><b>비로그인 메인 진입</b></td>
    <td>로그인 안 해도 인트로만 우회하면 무제한 둘러볼 수 있어 게스트 7일 제한이 의미 없음</td>
    <td>메인 들어올 때 게스트 시작 시점 검사 — 7일 지났으면 자동으로 회원가입 페이지로 보냄</td>
  </tr>
  <tr>
    <td align="center"><b>회원가입 페이지</b></td>
    <td>그냥 빈 회원가입 폼만 노출 — 왜 강제로 왔는지 사용자가 모름</td>
    <td>게스트 만료로 넘어온 경우 상단에 "7일 무료 체험이 끝났어요" 안내 배너 + "30초면 끝나요" 카피 추가</td>
  </tr>
</table>

<sub>3 파일 패치 (<code>intro/page.tsx</code>, <code>page.tsx</code>, <code>signup/page.tsx</code>) · 기존 <code>guestMode.ts</code> + <code>useGuestMode</code> 훅 재활용.</sub>

---

### v2.6 — Clean Code · 결합도 정리 + shop 폐기 + 가드 버그 수정

> 메인 페이지가 알림창 라이브러리(sweetalert2) 를 19곳에서 직접 호출하고 있었고, 환경 변수도 여러 파일에서 따로따로 불러오고 있었음. <code>/shop</code> 페이지는 v1.3 에서 음악 추천으로 대체된 뒤로 단순 리다이렉트만 하고 있어 청소가 필요했음. 그리고 무료 회원이 코스 1개 제한을 우회해 무제한 저장되던 버그도 같이 발견. 한 라운드에 같이 정리.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v2.5</th>
    <th align="center" width="290">v2.6</th>
  </tr>
  <tr>
    <td align="center"><b><code>/shop</code> 라우트</b></td>
    <td>v1.3 부터 폐기됐지만 음악 페이지로 자동 이동시키는 빈 파일이 남아 있어서 빌드 시 페이지 목록에 계속 잡힘</td>
    <td>폴더 통째로 삭제. 빌드 결과의 페이지 목록에서 <code>/shop</code> 사라진 것 확인</td>
  </tr>
  <tr>
    <td align="center"><b>환경변수</b></td>
    <td>환경 변수를 5개 파일에서 따로따로 직접 불러옴. 검색 키 검증 로직도 검색창 컴포넌트 안에 박혀 있음</td>
    <td><code>src/lib/env.ts</code> 한 파일에서만 환경 변수를 관리. 값 검증·없을 때 폴백·검색 키 형식 검사까지 자동 → 다른 파일은 한 줄로 가져다 쓰면 끝</td>
  </tr>
  <tr>
    <td align="center"><b>Kakao 지도 스크립트</b></td>
    <td>카카오 지도 API 키가 비어 있어도 "appkey=undefined" 라는 잘못된 주소로 스크립트를 불러옴</td>
    <td>키가 있을 때만 스크립트 삽입. 키 없으면 아예 안 넣음</td>
  </tr>
  <tr>
    <td align="center"><b><code>page.tsx</code> 알림</b></td>
    <td>메인 페이지 안에서 알림창 라이브러리(sweetalert2) 를 19곳에서 직접 호출. 정작 만들어둔 공통 알림 모듈은 import 만 해놓고 사용 안 함</td>
    <td>19곳 전부 공통 알림 함수 (성공 / 실패 / 경고 / 확인 다이얼로그) 로 교체. 메인 페이지의 sweetalert2 직접 호출 0개</td>
  </tr>
  <tr>
    <td align="center"><b>코스 저장 가드</b></td>
    <td>무료 회원이 코스 1개 이미 저장한 상태에서 또 저장하면 "덮어쓸까요?" 확인창은 뜨지만, <b>취소를 눌러도 저장이 그대로 실행</b>되던 버그 (콜백 안의 return 이 외부 함수를 종료 못 시킨 함정)</td>
    <td>확인창 결과를 기다렸다가 외부 함수에서 직접 분기 — 사용자가 취소하면 진짜로 저장 안 됨</td>
  </tr>
  <tr>
    <td align="center"><b>모달 분리</b></td>
    <td>코스 탭의 "장소 추가하기" 슬라이드업 화면이 메인 페이지 파일 안에 27줄로 박혀 있음</td>
    <td>별도 파일 (<code>AddPlaceModal.tsx</code>) 로 분리. 클릭 영역도 div → button 으로 바꿔 키보드 접근성까지 같이 개선</td>
  </tr>
</table>

<sub>5 파일 수정 + 2 파일 신규 (환경 변수 모듈, 장소 추가 모달) · shop 폴더 삭제 · 빌드 통과 (16/16 페이지) · 새 코드 검사 위반 0건.</sub>

---

### v2.7 — 게스트 모드 재설계 + 보안 Critical 3건 + 백엔드 결합도 정리

> 게스트 7일 카운트다운이 인트로나 메인에 들어가기만 해도 자동 시작돼서 사용자가 인지 못한 채 7일이 지나가던 UX 결함을 잡음.
> 같이 보안 점검에서 발견된 위험 항목 3건 (주소창 권한 위조 / 티켓 예약 ID 도용 / 업로드 URL 헤더 위조) 과
> 백엔드의 너저분한 예외 처리 (개별 try-catch · 의미 없는 RuntimeException 남용) 도 같이 정리.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v2.6</th>
    <th align="center" width="290">v2.7</th>
  </tr>
  <tr>
    <td align="center"><b>게스트 모드 시작점</b></td>
    <td>인트로나 메인에 들어가기만 해도 자동으로 7일 카운트다운 시작. 사용자는 자기가 게스트로 들어왔는지 모르는 채 7일이 흐름</td>
    <td><b>로그인 페이지의 "게스트로 7일 둘러보기" 버튼을 직접 눌렀을 때만</b> 카운트다운 시작. 사용자가 자기 의지로 선택</td>
  </tr>
  <tr>
    <td align="center"><b>D-N pill 노출 위치</b></td>
    <td>인트로 페이지에만 잔여일이 뜨고 메인에 들어가면 안 보여서 사용자 불편</td>
    <td>인트로뿐 아니라 <b>메인 페이지 상단</b> 에도 항상 잔여일 라벨 표시. 옆에 "지금 가입하기" 버튼도 함께</td>
  </tr>
  <tr>
    <td align="center"><b>비로그인 메인 진입 차단</b></td>
    <td>비로그인 사용자가 메인 진입하면 자동으로 게스트가 시작돼서 사실상 차단 없음</td>
    <td>게스트로 시작 안 한 사용자는 로그인 페이지로, 7일 지난 사용자는 회원가입 페이지로 강제 이동</td>
  </tr>
  <tr>
    <td align="center"><b>URL 쿼리 권한 신뢰 (S1)</b></td>
    <td>메인 페이지가 주소창의 "isPremium=true&role=ADMIN" 같은 값을 검증 없이 받아서 브라우저에 저장 → <b>주소만 조작해도 어드민 권한을 가져갈 수 있는 보안 구멍</b></td>
    <td>그 코드 통째 삭제. 진짜 소셜 로그인 흐름은 OAuth 콜백 페이지에서 서버에 "내 정보 알려줘" 호출 → 서버가 검증한 정보만 사용</td>
  </tr>
  <tr>
    <td align="center"><b>GameController IDOR (S2)</b></td>
    <td>티켓 예약 API 가 클라이언트가 보낸 "userId=어쩌구" 를 그대로 사용 → <b>다른 사람 ID 로 티켓 선점 가능했던 구멍</b></td>
    <td>로그인 토큰에서 자동으로 추출한 사용자 ID 만 사용. 토큰 없으면 거부</td>
  </tr>
  <tr>
    <td align="center"><b>X-Forwarded-Host 스푸핑 (S4)</b></td>
    <td>이미지 업로드 결과 URL 을 만들 때 'X-Forwarded-Host' 헤더를 검증 없이 그대로 사용 → <b>헤더를 위조하면 피싱 도메인 URL 을 반환받을 수 있던 구멍</b></td>
    <td>허용 도메인 패턴 목록과 매칭될 때만 헤더 값 신뢰. 등록 안 돼 있으면 서버 자체 도메인만 사용 (가장 보수적)</td>
  </tr>
  <tr>
    <td align="center"><b>Controller 예외 결합도 (B3)</b></td>
    <td>관리자 보상 지급 / 이메일 찾기 API 가 try-catch 로 에러를 자기가 직접 처리해서 공통 에러 응답 포맷이 깨짐</td>
    <td>try-catch 제거하고 표준 예외 (입력 오류 / 리소스 없음) 로 던지게 변경. 모든 에러는 공통 핸들러 한 곳에서 일관되게 처리</td>
  </tr>
</table>

<sub>프론트 8 파일 (게스트 모드 모듈, 인트로 / 로그인 / 메인 / 어드민 페이지 등) · 백엔드 7 파일 (Game / Chat / Admin / Auth Controller, Auth / Stamp Service, 설정 파일) · 프론트 빌드 16/16 페이지 통과 · 새 코드 검사 위반 0건.</sub>

---

### v2.7.1 / v2.7.2 — 백엔드 빌드 통과 핫픽스

> v2.7 머지 후 로컬에서 백엔드 빌드 (<code>./gradlew clean build</code>) 가 코드 포맷 검사 단계에서 두 번 실패. 본 작업과는 무관한 빌드 설정 이슈라 핫픽스 두 개로 분리 처리.

<table align="center">
  <tr>
    <th align="center" width="120">버전</th>
    <th align="center" width="200">증상</th>
    <th align="center" width="240">원인</th>
    <th align="center" width="240">해결</th>
  </tr>
  <tr>
    <td align="center"><b>v2.7.1</b></td>
    <td>Java 파일 120개가 줄바꿈 문자 불일치로 검사 실패</td>
    <td>코드 포맷 검사기가 Windows 에서는 CRLF(윈도우식 줄바꿈) 를 기대하는데, 저장소 파일은 LF(맥/리눅스식) 로 저장돼 있어서 매번 충돌</td>
    <td>빌드 설정에 "줄바꿈은 LF 통일" 명시 + 저장소에 <code>.gitattributes</code> 파일 추가해서 git 차원에서도 LF 고정 (윈도우 전용 스크립트만 예외)</td>
  </tr>
  <tr>
    <td align="center"><b>v2.7.2</b></td>
    <td>5 파일 (Game / Chat / Admin / Auth Controller + StampService) 의 주석과 코드 줄바꿈이 한 줄 100자 규칙 위반</td>
    <td>v2.7 에서 추가한 한국어 멀티라인 주석을 자동 코드 정리 도구 (google-java-format) 가 100자 안에 맞춰 다시 줄바꿈하려고 시도 → 결과 불일치. GameController if 조건도 102자로 살짝 초과</td>
    <td>주석을 짧게 재작성 (6줄 → 3~4줄), if 조건을 3줄로 줄바꿈, 예외 메시지를 한 줄로 합침. 마지막에 로컬에서 자동 포맷이 한 줄을 추가로 분리한 결과를 main 과 동기화</td>
  </tr>
</table>

<sub><code>./gradlew clean build</code> 통과 확인 후 v2.8 진행.</sub>

---

### v2.8 — 게스트 탭 접근 정책 + 인트로 홍보

> v2.7 에서 게스트 모드 시작 방식만 정리했더니, 정작 게스트 사용자가 마이페이지 / 동행 여권을 열려고 해도 "로그인 필요" 차단에 걸려서 게스트 모드가 사실상 무의미한 상태였음. 어느 탭은 게스트도 들어가고 어느 탭은 회원만 가능한지를 한 곳에서 정의하고, 모든 진입 경로 (탭 클릭 / 이전 탭 복원 / 주소창 직접 입력) 에 같은 규칙을 적용.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v2.7</th>
    <th align="center" width="290">v2.8</th>
  </tr>
  <tr>
    <td align="center"><b>게스트 탭 접근</b></td>
    <td>마이페이지 / 동행 여권 / 메이트 모두 차단 — 마이페이지·여권은 게스트한테도 보여줘야 의미 있는데 다 막혀서 사용자 항의</td>
    <td>마이페이지 / 동행 여권은 게스트도 접근 가능 (데이터 없으면 빈 화면 표시). 코스 / 음악 / 메이트는 회원만 이용</td>
  </tr>
  <tr>
    <td align="center"><b>회원 전용 탭 시도 시</b></td>
    <td>"로그인이 필요합니다" 한 가지 안내만 노출 (게스트와 비로그인 구분 안 함)</td>
    <td>게스트가 시도하면 → "회원 전용 기능" 안내 + 회원가입 버튼. 비로그인 사용자는 → 기존 로그인 안내 그대로</td>
  </tr>
  <tr>
    <td align="center"><b>sessionStorage 복원</b></td>
    <td>이전에 보던 탭이 코스 / 음악이었으면 게스트도 그대로 진입돼서 차단 우회 가능</td>
    <td>이전 탭 복원할 때도 권한 검사 — 게스트가 못 가는 탭이면 지도 탭으로 대체</td>
  </tr>
  <tr>
    <td align="center"><b><code>?tab=music</code> URL 직접 진입</b></td>
    <td>주소만으로 진입 가능해서 차단 우회 가능</td>
    <td>같은 권한 검사 함수로 막아서 못 가면 지도 탭으로 대체</td>
  </tr>
  <tr>
    <td align="center"><b>인트로 게스트 홍보</b></td>
    <td>인트로 화면에서 게스트 모드 옵션이 안 보여서 회원가입이 부담스러운 사용자가 그냥 떠남</td>
    <td>인트로 첫 화면과 마지막 화면 모두 "가입 없이 게스트로 7일 둘러보기" 안내 추가 + 로그인 페이지로 연결</td>
  </tr>
</table>

<sub>메인 / 인트로 2개 파일 수정. 접근 정책은 메인 페이지 최상단에 "회원 전용 탭 목록" + "탭 접근 가능 여부 검사" 로 한 번만 정의 → 탭 클릭 / 이전 탭 복원 / 주소창 진입 세 곳 모두 같은 함수를 호출하도록 통일. 프론트 빌드 16/16 페이지 통과.</sub>

---

### v2.9 — 보안 IDOR 2건 + 권한 재검증 + 남은 백엔드 부채 정리

> v2.7 에서 GameController IDOR 만 봉합했더니, 같은 패턴이 MyCourse / Wishlist 두 컨트롤러에 그대로 남아 있다는 게 v2.8 재감사에서 발견. 같이 OAuth 콜백 이후 localStorage 의 role/isPremium 위조 가능 문제, 남은 RuntimeException 3건, 메모리 필터링 N+1 위험, MyCourse 엔티티 직접 노출까지 한 라운드에 정리.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v2.8</th>
    <th align="center" width="290">v2.9</th>
  </tr>
  <tr>
    <td align="center"><b>위시리스트 IDOR (Critical)</b></td>
    <td>주소창의 userId 를 검증 없이 그대로 사용 → 다른 사람 위시리스트 토글 / 조회 가능</td>
    <td>주소창 userId 가 로그인 토큰의 userId 와 일치할 때만 통과. 다르면 거부 (403)</td>
  </tr>
  <tr>
    <td align="center"><b>내 코스 IDOR (Critical)</b></td>
    <td>코스 저장 / 조회 / 삭제 모두 클라이언트가 보낸 userId 신뢰 → 타인 코스 조작 가능</td>
    <td>세 엔드포인트 모두 토큰 userId 와 일치 검증. 삭제는 코스 소유자 검사까지 추가</td>
  </tr>
  <tr>
    <td align="center"><b>OAuth 후 권한 위조 (High)</b></td>
    <td>로그인 직후 localStorage 에 저장된 role / isPremium 을 클라이언트가 신뢰 → devtools 로 어드민 / 프리미엄 위조 가능</td>
    <td>비공개 페이지 진입 시마다 서버에 "내 정보 다시 알려줘" 호출해서 검증된 값으로 덮어씀. 위조해도 즉시 정정</td>
  </tr>
  <tr>
    <td align="center"><b>남은 RuntimeException</b></td>
    <td>AI 호출 실패 / 메일 발송 실패에 의미 없는 RuntimeException 사용 → 공통 에러 핸들러가 400 으로 처리 (실제론 서버 장애)</td>
    <td>둘 다 표준 예외 (외부 서비스 장애) 로 격상해 공통 에러 핸들러가 409 로 일관 응답. AuthService 의 소셜 가입 분기는 의도적이라 유지</td>
  </tr>
  <tr>
    <td align="center"><b>지도 마커 N+1 위험</b></td>
    <td>팝업 전체를 메모리에 불러와서 자바 코드로 PENDING 만 거름 → 데이터 늘면 메모리 폭발 위험</td>
    <td>이미 만들어둔 SQL WHERE 절 쿼리 재사용. row 수와 무관하게 안전</td>
  </tr>
  <tr>
    <td align="center"><b>MyCourse 엔티티 → DTO</b></td>
    <td><code>List&lt;MyCourse&gt;</code> JPA 엔티티 직접 JSON 직렬화 → LAZY 필드 폭탄 위험</td>
    <td><code>MyCourseResponseDto.fromEntity()</code> 변환. 프론트 필드명은 그대로 유지 (호환성)</td>
  </tr>
</table>

<sub>백엔드 7 파일 (Wishlist / MyCourse Controller + Service + AiCourse / Email / PopupStore Service + MyCourseResponseDto 신규) · 프론트 1 파일 (AuthGuard) · 프론트 빌드 16/16 페이지 통과. PopupStore / Admin Controller 의 엔티티 → DTO 는 영향 너무 커서 다음 라운드(v2.10) 로 분리.</sub>

---

### v2.10 — 어드민 대시보드 확장 + 실시간 로그 (브라우저에서 보는 모니터링)

> 운영 모니터링이 SSH/xshell 들어가서 `htop` / `journalctl -f` 보는 거에 의존하던 상태를 **크롬 어드민 페이지 한 곳** 으로 옮김. 운영자가 외부 환경에서 폰만 들고도 서버 상태 / 실시간 로그 확인 가능.

<table align="center">
  <tr>
    <th align="center" width="180">항목</th>
    <th align="center" width="290">v2.9</th>
    <th align="center" width="290">v2.10</th>
  </tr>
  <tr>
    <td align="center"><b>어드민 메트릭</b></td>
    <td>CPU + 메모리 (실시간 라인 차트) 만 표시</td>
    <td>+ JVM Heap/Thread, HTTP 요청수/p95/5xx, DB 커넥션 풀, 오늘 자동수집 4종 카드 신규</td>
  </tr>
  <tr>
    <td align="center"><b>새 메트릭 추가 비용</b></td>
    <td>어드민 메트릭 컨트롤러를 직접 수정 (모든 게이지를 컨트롤러가 알아야)</td>
    <td>"메트릭 스냅샷 제공자" 인터페이스를 구현한 클래스 한 개 추가 = 끝. 컨트롤러는 자동 합성</td>
  </tr>
  <tr>
    <td align="center"><b>실시간 로그 확인</b></td>
    <td>SSH 로 서버 들어가서 <code>journalctl -fu popspot.service</code></td>
    <td>어드민 페이지의 <b>실시간 로그 탭</b> 에서 바로. 정규식 필터 / 일시정지 / 다운로드 / 로그 레벨별 색</td>
  </tr>
  <tr>
    <td align="center"><b>로그 스트림 방식</b></td>
    <td>해당 없음</td>
    <td>Server-Sent Events (SSE). 30초마다 keepalive 로 프록시가 끊는 거 방지. 끊기면 1→2→4초 자동 재연결</td>
  </tr>
  <tr>
    <td align="center"><b>SSE 인증</b></td>
    <td>해당 없음</td>
    <td>EventSource 가 헤더를 못 보내므로 SSE 경로 한정 <code>?token=</code> 쿼리 폴백 (다른 경로는 차단)</td>
  </tr>
  <tr>
    <td align="center"><b>어드민 KPI / 차트</b></td>
    <td>인라인 JSX 로 다 들어있음 (관리 어려움)</td>
    <td><code>MetricCard</code>, <code>LiveLineChart</code>, <code>useDashboardMetrics</code> 세 컴포넌트로 추출. 새 카드 추가가 한 줄로</td>
  </tr>
</table>

<sub>백엔드 9 파일 신규 (메트릭 5 + 로그 3 + DTO ·기존 컨트롤러/필터/properties 4 수정) · 프론트 5 파일 신규 (메트릭 3 + 로그 2) · admin/page.tsx 카드 4개 + LOGS 탭 추가 · 프론트 빌드 16/16 통과. Spring Boot Admin (옵션 C) 은 D 와 기능 80% 중복이라 스킵. Prometheus/Grafana (옵션 D) 는 별도 v2.11 분리.</sub>

---

### v2.10.1 — 빌드 통과 + 배포 운영 핫픽스 (Spotless + 배포 절차)

> v2.10 머지 후 두 단계에서 막혔다. ① 빌드: 한국어 멀티라인 JavaDoc + 인라인 람다가 google-java-format AOSP 와 충돌해 spotlessJavaCheck 6 파일 violation. ② 배포: 빌드는 통과했는데 운영 NAS 에 옛 jar 가 그대로 돌고 있었고, 신규 환경변수(<code>LOG_FILE_PATH</code>) 와 로그 디렉토리가 없어서 실시간 로그가 "대기 중" 상태였다.

<table align="center">
  <tr>
    <th align="center" width="180">단계</th>
    <th align="center" width="290">증상</th>
    <th align="center" width="290">해결</th>
  </tr>
  <tr>
    <td align="center"><b>빌드 (Spotless)</b></td>
    <td>6 파일 JavaDoc reflow + LogTailService 의 inline ThreadFactory 람다가 AOSP 100-col 들여쓰기와 충돌</td>
    <td>JavaDoc 콤팩트 재작성 (한 줄 80자 이내, &lt;p&gt; 단락 분리, 멀티라인 wrap 금지) + 람다를 <code>newDaemonThread</code> helper 메서드로 추출</td>
  </tr>
  <tr>
    <td align="center"><b>배포 (scp 경로)</b></td>
    <td>새 jar 를 <code>/home/reo4321/popspot/app.jar</code> 로 올렸는데 systemd 는 <code>/home/reo4321/popspot-backend-0.0.1-SNAPSHOT.jar</code> 를 보고 있어서 옛 jar (5월 11일) 그대로 실행</td>
    <td>scp 대상 경로를 systemd 가 실제로 보는 파일 이름과 정확히 일치시킴. 검증: <code>unzip -l ...jar | grep AdminMetricsController</code> 의 class 파일 크기 (2780 → 4450 byte) 비교</td>
  </tr>
  <tr>
    <td align="center"><b>운영 (404 마스킹)</b></td>
    <td>옛 jar 에 <code>/api/admin/metrics/dashboard</code> 엔드포인트 자체가 없어 백엔드는 404 + HTML 응답 → 프론트의 EventSource 가 "MIME 이 text/event-stream 아님" 으로 abort</td>
    <td>새 jar 배포 후 systemd restart, journal 에서 매핑 등록 확인</td>
  </tr>
  <tr>
    <td align="center"><b>실시간 로그 비활성</b></td>
    <td>어드민 LOGS 탭이 "로그 대기 중... logging.file.name 환경변수가 설정돼야" 표시 — 환경파일에 <code>LOG_FILE_PATH</code> 누락 + <code>/var/log/popspot/</code> 디렉토리 부재</td>
    <td><code>/var/log/popspot/</code> 생성 (소유자 reo4321), <code>/home/reo4321/popspot.env</code> 에 <code>LOG_FILE_PATH=/var/log/popspot/popspot.log</code> 추가, <code>systemctl restart popspot</code></td>
  </tr>
  <tr>
    <td align="center"><b>보안 (env 권한)</b></td>
    <td><code>popspot.env</code> 안에 JWT_SECRET / DB_PASSWORD 등 시크릿. 기본 644 권한이면 같은 VM 의 다른 사용자도 읽기 가능</td>
    <td><code>chmod 600 /home/reo4321/popspot.env</code> — systemd 가 root 로 읽고 reo4321 로 실행하므로 600 도 정상 작동</td>
  </tr>
</table>

<sub>v2.10.1 = spotless 핫픽스 7 파일 (<code>LogRingBuffer</code>, <code>LogTailService</code>, <code>DbPool/Http/JvmMetricSnapshotProvider</code>, <code>JwtAuthenticationFilter.extractToken</code>, <code>AdminMetricsController</code>) + spotlessApply 자동 수정 2 파일 동기화. 배포 절차 정정은 코드 변경 없음 — 운영 환경 셋업 4건.</sub>

---

### v2.11 — 의견 보내기 게시판 (Footer + MY 탭 + 어드민, 3 레이어 통합)

> 사용자 피드백을 받을 공식 채널이 없어서 카카오톡 / 메일로 들어오는 의견이 산발적으로 분실됐다. v2.11 은 동선 3 곳 (Footer 링크 · MY 탭 카드 · 어드민 검수 탭) 에 같은 데이터 모델로 의견 보내기 기능을 심어, 로그인 / 게스트 모두 같은 폼으로 제출하고 어드민이 한 화면에서 검수 → 답변 → 상태 변경 까지 처리할 수 있게 한다.

<table align="center">
  <tr>
    <th align="center" width="200">레이어</th>
    <th align="center" width="280">v2.10 까지</th>
    <th align="center" width="280">v2.11</th>
  </tr>
  <tr>
    <td align="center"><b>Footer 링크</b></td>
    <td>의견 보낼 공식 동선 없음 (Footer 의 비즈니스 / 광고 mailto 만)</td>
    <td><code>의견 보내기</code> 항목 추가 → <code>/feedback</code> 전용 페이지로 이동. 비로그인 / 게스트 / 정식 회원 모두 동일 진입</td>
  </tr>
  <tr>
    <td align="center"><b>MY 탭 카드</b></td>
    <td>본인이 보낸 의견 / 받은 답변을 확인할 곳이 없음</td>
    <td><code>내가 보낸 의견</code> 카드 신규. 최근 3건 노출 + "전체 보기" 링크. 어드민 답변이 달리면 즉시 표시</td>
  </tr>
  <tr>
    <td align="center"><b>어드민 검수 탭</b></td>
    <td>이메일 / 카톡 에서 수기 추적 → 답변 SLA 들쭉날쭉</td>
    <td>FEEDBACK 탭 신규. 상태 카운트 4 카드 + 필터 + 펼침형 답변 에디터 + 삭제. 답변 작성 시 <code>repliedAt</code> 자동 갱신</td>
  </tr>
  <tr>
    <td align="center"><b>게스트 허용</b></td>
    <td>비로그인 사용자는 의견 제출 불가능</td>
    <td>userId nullable + guestEmail 선택 입력. <code>/api/feedback</code> 는 <code>permitAll</code> 이고 <code>/api/feedback/me</code> 만 인증 요구</td>
  </tr>
  <tr>
    <td align="center"><b>결합도</b></td>
    <td>—</td>
    <td>컨트롤러 ≈ 30 줄 (URL + Authentication 추출만). 화이트리스트 (카테고리 4종 / 상태 4종) 는 <code>FeedbackService</code> 의 <code>Set&lt;String&gt;</code> 상수 한 곳. 신규 값 추가 = Set 만 수정</td>
  </tr>
  <tr>
    <td align="center"><b>UX 톤</b></td>
    <td>—</td>
    <td>이모티콘 0 / AI 풍 카피 0. 라벨은 한국어 텍스트만 ("버그" / "기능 제안" / "좋은 점" / "그 외"). 평서체 ("확인 후 처리 결과를 알려 드리겠습니다.")</td>
  </tr>
</table>

<sub>백엔드 9 파일 신규 (V7 migration · 엔티티 · 리포지토리 · DTO 3 · 서비스 · 사용자 컨트롤러 · 어드민 컨트롤러) · 프론트 6 파일 신규 (types/feedback + features/feedback/{api,FeedbackForm,MyFeedbackList,AdminFeedbackPanel} + app/feedback/page.tsx) · 수정 4 파일 (Footer / AuthGuard / app/page.tsx MY 탭 / admin/page.tsx FEEDBACK 탭) · 프론트 빌드 17/17 페이지 통과 (기존 16 + /feedback 1). Prometheus + Grafana (옵션 D) 는 v2.12 로 다시 미룸.</sub>

---

## 폴더 구조 (백엔드)

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

## 트러블슈팅

| # | 문제 | 해결 |
|:--:|---|---|
| 1 | Oracle 채팅 메시지 저장 시 `ORA-01400` (ID NULL) | 수동 SEQUENCE 코드 제거 + PostgreSQL `IDENTITY` 자동 생성으로 전환 |
| 2 | `LazyInitializationException` 갑자기 터짐 | EAGER → LAZY + fetch join |
| 3 | Spotify 가 "아이유 좋은날" 못 찾음 | Groq 로 영문 표기 변환 ("IU good day") |
| 4 | application-prod.properties 우선순위 함정 | 외부 파일 → 환경변수만 사용 |
| 5 | Gemini 키 GitHub 노출 → 자동 차단 | 시크릿 스캔 GitHub Action 추가 |
| 6 | Algolia 키 누락 시 `@PostConstruct` 실패 → 부팅 자체 불가 | enabled 플래그 + graceful fallback (검색은 비활성) |
| 7 | `targetUserId = user.userId \|\| user.id` 가 `undefined` 일 때 `?userId=undefined` 로 API 호출 | v1.5 의 `any` → 도메인 타입 좁힘 과정에서 발견. empty string fallback + early-return notify 로 차단 |
| 8 | `./gradlew build` 가 Windows 에서 `Could not start sentry-cli-3.2.0.exe` 로 실패 | Defender / SmartScreen 차단. `-x sentryBundleSourcesJava -x sentryCollectSourcesJava` 로 우회 (로컬 빌드엔 불필요한 단계) |
| 9 | SCP 가 `dest open: No such file or directory` | SCP 는 디렉터리 생성 안 함. `ssh user@host "mkdir -p /path"` 선행 필수 |
| 10 | `git rebase --continue` 가 `cannot lock ref: is at X but expected Y` | rebase `edit` 모드에서 `--amend` 대신 일반 `git commit` 한 경우. `git rebase --quit` (HEAD/working tree 유지) 으로 안전 복구 |
| 11 | `./gradlew clean` 이 `Unable to delete directory build/` 로 실패 (Windows) | Java 프로세스 / Gradle 데몬이 `build/classes/` 의 .class 파일을 잡고 있음. `Get-Process java \| Stop-Process -Force` + `./gradlew --stop` 후 재시도. 끝까지 안 풀리면 PC 재부팅 |
| 12 | `./gradlew build` 의 `:test` 단계에서 `PSQLException` → contextLoads() 실패 | 로컬에 PostgreSQL 안 떠있는 상태에서 Spring Boot 풀 컨텍스트 로드 시도. `-x test` 로 스킵 (운영은 systemd 가 DB 환경변수 주입하므로 안전) |
| 13 | scp 로 jar 올렸는데 systemd 가 옛 jar 그대로 실행 | scp 대상 경로 (`/home/reo4321/popspot/app.jar`) 와 systemd 가 보는 경로 (`/home/reo4321/popspot-backend-0.0.1-SNAPSHOT.jar`) 가 달랐음. 검증: `unzip -l <jar> \| grep <NewController>` 의 byte 크기로 옛/새 구분 |
| 14 | 프론트 콘솔 404 + `EventSource MIME ("text/html") is not "text/event-stream"` 도배 | 운영 백엔드에 v2.10 엔드포인트 미배포 상태 (옛 jar). 새 jar 배포 + `systemctl restart` 후 해결. EventSource 의 MIME 에러는 404 의 부수효과 (404 본문이 HTML) |
| 15 | 어드민 LOGS 탭이 "로그 대기 중..." 에서 멈춤 | `LOG_FILE_PATH` 환경변수 미설정 (LogTailService 가 시작 자체를 안 함). 환경파일에 `LOG_FILE_PATH=/var/log/popspot/popspot.log` 추가 + `mkdir -p /var/log/popspot && chown reo4321:reo4321` 선행 |
| 16 | `popspot.env` 가 644 권한이라 시크릿 노출 위험 | `chmod 600 /home/reo4321/popspot.env`. systemd 가 root 로 읽고 reo4321 로 프로세스 실행 — 600 이어도 정상 동작 |

---

## TODO

- [ ] iOS / Android 네이티브 (Capacitor 검토)
- [ ] 팝업 이미지 OCR — 자동수집 정확도 더 올리기
- [ ] AI 어시스턴트 — 사용자 취향 학습
- [ ] 단위 테스트 커버리지 50%+ (지금 10%)
- [x] 시놀로지 NAS 이전 완료 (Proxmox / Ubuntu VM, GCP VM 정지만 대기)

---

## 시작하기

### 요구 사항

| 영역 | 버전 |
|---|---|
| JDK | 21 (Temurin 권장) |
| Node.js | 20 LTS |
| PostgreSQL | 14+ |
| Redis | 6+ |

### 백엔드

```bash
git clone https://github.com/hanshhx/pop-spot.git
cd pop-spot/popspot-backend

# 1. 환경변수 채우기 (.env.example → .env.local)
cp .env.example .env.local
$EDITOR .env.local

# 2. Postgres / Redis 가 떠 있어야 함
#    macOS:  brew services start postgresql@14 redis
#    Ubuntu: sudo systemctl start postgresql redis-server

# 3. 실행 (Windows PowerShell)
./run-local.ps1
# 또는 (macOS / Linux)
set -a && source .env.local && set +a && ./gradlew bootRun
```

기본 포트 `:8080`. Flyway 가 부팅 시 마이그레이션 자동 적용. JWT/DB 시크릿이 비어 있으면 의도적으로 부팅이 실패한다.

### 프론트엔드

```bash
cd pop-spot/popspot-frontend
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

빌드는 `npm run build`, 정적 실행은 `npm run start`.

---

## 환경 변수

값은 절대 커밋하지 말 것. 운영에서는 systemd `EnvironmentFile=/etc/popspot/popspot.env`, Vercel 에서는 프로젝트 Settings → Environment Variables 에 설정.

### 백엔드 (`popspot-backend/.env.local`)

| 키 | 용도 | 비고 |
|---|---|---|
| `DB_URL` · `DB_USERNAME` · `DB_PASSWORD` | PostgreSQL 접속 | 부팅 검증 — 누락 시 실패 |
| `JWT_SECRET` | HS256 서명 키 | **32 바이트 이상** 필수 |
| `JWT_EXPIRATION` | 액세스 토큰 만료(ms) | 기본 1h |
| `MAIL_USERNAME` · `MAIL_PASSWORD` | SMTP 인증 메일 | Gmail App Password |
| `GROQ_API_KEY` · `GROQ_MODEL_NAME` · `GROQ_BASE_URL` | LLM (정규화 · 무드 분석) | 기본 모델 `llama-3.3-70b-versatile`, 기본 URL `https://api.groq.com/openai/v1` |
| `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` | 검색 API + OAuth2 | 두 용도 동일 키 |
| `KAKAO_REST_API_KEY` · `KAKAO_LOCAL_API_KEY` | 검색 / 지오코딩 | |
| `SPOTIFY_CLIENT_ID` · `SPOTIFY_CLIENT_SECRET` | Spotify Web API | Client Credentials |
| `YOUTUBE_API_KEY` | YouTube Data API v3 | quota 절약 위해 lazy fetch |
| `SENTRY_DSN` | 에러 모니터링 | 운영만 |
| `APP_ALLOWED_ORIGINS` | CORS 패턴 화이트리스트 | 예: `https://popspot.co.kr,https://*.vercel.app` |
| `OAUTH_GOOGLE_CLIENT_ID/SECRET` | Google OAuth2 | |
| `OAUTH_KAKAO_CLIENT_ID/SECRET` | Kakao OAuth2 | |
| `OAUTH_NAVER_CLIENT_ID/SECRET` | Naver OAuth2 | |

### 프론트엔드 (`popspot-frontend/.env.local`)

| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_API_URL` | 백엔드 REST 베이스 (예: `https://vm-113.tailc57dd4.ts.net`) |
| `NEXT_PUBLIC_SOCKET_URL` | STOMP 엔드포인트 (없으면 API 호스트로 폴백) |
| `NEXT_PUBLIC_SENTRY_DSN` | 클라이언트 에러 추적 |

---

## 배포

| 컴포넌트 | 환경 |
|---|---|
| 프론트엔드 | Vercel — `main` 머지 시 자동 배포, 도메인 `popspot.co.kr` |
| 백엔드 | 친구 Synology NAS 위의 Proxmox VE · Ubuntu 22.04 VM, systemd 서비스 `popspot.service` |
| HTTPS | Tailscale Funnel — 인증서 자동 갱신, 별도 nginx 없음 |
| DB / Cache | 동일 VM 안에 PostgreSQL 14 · Redis 6 (각각 systemd) |
| 스케줄러 | Spring `@Scheduled` — 04:00 자동수집, 05:00 만료 처리 (KST) |
| 마이그레이션 | Flyway · `ddl-auto=validate` (부팅 시 스키마 불일치면 실패) |

운영 진단 명령은 [`SYNOLOGY_MIGRATION_GUIDE.md`](./SYNOLOGY_MIGRATION_GUIDE.md), 전체 변경 이력은 [`PROJECT_CHANGELOG.md`](./PROJECT_CHANGELOG.md) 참고.

---

## 디렉터리

```
pop-spot/
├── popspot-backend/      Spring Boot 4 · Java 21 · Flyway
├── popspot-frontend/     Next.js 16 · TypeScript · Tailwind · middleware.ts
├── ARCHITECTURE.md       시스템 구성도 (상세)
├── PROJECT_CHANGELOG.md  버전별 변경 이력 (~5000 줄)
└── SYNOLOGY_MIGRATION_GUIDE.md
```

---

## 기여

개인 포트폴리오 프로젝트라 외부 PR 은 받지 않는다.
버그 / 데이터 오류 / takedown 요청은 GitHub Issues 에 남겨 주세요. takedown 은 24h SLA.

---

## 라이선스

소스 코드는 비공개 (All rights reserved).
브랜드명 "POP-SPOT" · 도메인 `popspot.co.kr` · 로고 · UI 디자인은 별도 권리로 보호된다.
포트폴리오 열람 목적의 코드 읽기는 환영하지만, 재배포·재호스팅·상표 사용은 사전 동의가 필요하다.

---

## 만든 사람

**동현** · 디자인 도움 [@hanshhx](https://github.com/hanshhx)

문의 / 버그 제보는 GitHub Issues 로.

<div align="center">
<sub>Made with coffee in Seoul</sub>
</div>
