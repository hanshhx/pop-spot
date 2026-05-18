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

> **상황** — 학부 캡스톤 과제로 시작. "가입 → 로그인 → 팝업 조회" 흐름만 돌면 충분했던 시기.
> **그래서 이렇게 만들었다** — GCP Compute Engine 위에 모놀리식 Spring Boot 한 덩어리, DB 는 정적 데이터 안정성 보고 Oracle 선택, 시크릿은 빠르게 돌리려고 `application.properties` 에 평문, CORS 는 로컬 개발 편의로 `*` 전부 허용, JWT 시크릿은 임시값 `"default_secret"`.
> **나중에 후회한 것** — 이 모든 결정이 v1.1 에서 한 번에 부메랑으로 돌아옴. 시크릿은 GitHub 시크릿 스캐너에 잡혀 노출, Oracle 은 채팅 메시지 저장에서 ID NULL 에러 (`ORA-01400`), 보안 감사에서 OWASP Top 10 거의 다 위배.

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

<sub><b>그땐 이랬다</b> — GCP Compute Engine 위 모놀리식 Spring Boot. DB 는 Oracle (정적 데이터 안정성 목적, 시퀀스는 수동). 시크릿은 <code>application.properties</code> 에 평문 커밋, <code>CORS *</code> 전부 허용, JWT 시크릿은 <code>"default_secret"</code>. Gemini Free RPM 10 / RPD 1,500. BCrypt strength 기본값(10). 외부 트래픽은 인스턴스 8080 직접 노출.</sub>

<br/>

### v1.1 — 보안 정비 + AI 교체

> **본격 운영 직전, v1.0 의 빚을 한 번에 갚은 단계.**
>
> **보안 정비 (OWASP Top 10 기준)**
> - 모든 시크릿을 환경변수 `${ENV:}` 로 빼고 **누락 시 부팅 실패**로 강제 (실수로 빠뜨려도 운영 사고 X)
> - JWT 시크릿에 **32 바이트 이상 강제 검증** — HS256 의 보안 강도는 키 길이 비례, 짧은 키는 brute-force 로 토큰 위조 가능
> - CORS `*` → **패턴 화이트리스트**, 알 수 없는 도메인의 prefllight 차단
> - BCrypt strength **10 → 12** (해싱 비용 4배 = brute-force 비용 4배, 사용자 체감 ms 영향은 무시 가능)
> - Rate Limit (Bucket4j) 도입 — **로그인 5/min, 이메일 5/h** 로 무차별 시도 차단
> - 결제 검증을 **클라 검증만 → 서버가 PortOne API 직접 조회** 로 (이전엔 사용자가 결제창 닫고 가짜 응답 만들어 보낼 수 있었음)
>
> **DB 이전 — Oracle → PostgreSQL**
> 채팅 메시지 저장할 때 Oracle 이 자동으로 ID 안 만들어줘서 SEQUENCE 수동 설정. 한 번 빠뜨려서 `ORA-01400` (NULL ID) 사고 → PostgreSQL `IDENTITY` 는 ID 자동 생성이라 SEQUENCE 코드 자체가 사라짐. 스탬프(Stamp) 기능 새로 만들 때 깨끗하게 IDENTITY 로 시작.
>
> **AI 이전 — Gemini → Groq llama-3.3-70b**
> Gemini Free 한도가 RPM 10 / RPD 1,500. 자동수집 (60 키워드 × 2.2초 간격 LLM 호출) 한 번 돌리면 거의 다 씀. 게다가 키가 GitHub 채팅에 노출되니 Google 시크릿 스캐너가 quota 를 0 으로 강제 변경 — 같은 프로젝트의 새 키도 다 죽음. Groq 는 **RPM 30 / RPD 14,400** 로 자동수집 + 코스 추천 동시에 여유, 비용 0.

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
    <td align="center">Oracle (Sequence 수동 · 채팅 저장 시 <code>ORA-01400</code>)</td>
    <td align="center">PostgreSQL <code>IDENTITY</code> 자동 생성 + Flyway (validate)</td>
  </tr>
  <tr>
    <td align="center"><b>시크릿</b></td>
    <td align="center">하드코딩 · 깃 커밋</td>
    <td align="center">전부 <code>${ENV:}</code>, 누락 시 부팅 실패</td>
  </tr>
  <tr>
    <td align="center"><b>JWT</b></td>
    <td align="center"><code>default_secret</code></td>
    <td align="center">HS256 · 32B 이상 강제 검증</td>
  </tr>
  <tr>
    <td align="center"><b>CORS</b></td>
    <td align="center"><code>*</code></td>
    <td align="center">패턴 화이트리스트</td>
  </tr>
  <tr>
    <td align="center"><b>Rate Limit</b></td>
    <td align="center">없음</td>
    <td align="center">Bucket4j (로그인 5/min, 메일 5/h)</td>
  </tr>
  <tr>
    <td align="center"><b>비밀번호</b></td>
    <td align="center">BCrypt strength 10</td>
    <td align="center">strength 12</td>
  </tr>
  <tr>
    <td align="center"><b>결제</b></td>
    <td align="center">클라 검증만</td>
    <td align="center">Iamport 서버 재검증 + 변조 시 자동 환불</td>
  </tr>
  <tr>
    <td align="center"><b>관측</b></td>
    <td align="center">없음</td>
    <td align="center">Sentry · Micrometer</td>
  </tr>
  <tr>
    <td align="center"><b>AI</b></td>
    <td align="center">Gemini Free · RPM 10 / RPD 1,500</td>
    <td align="center">Groq llama-3.3-70b · RPM 30 / RPD 14,400</td>
  </tr>
</table>

<br/>

### v1.2 — 집서버 이전 + nginx 제거

> **왜 옮겼나** — GCP Free Tier 가 2026-05-28 에 만료 예정. 사이드 프로젝트라 유료 결제 부담 + 마침 친구가 시놀로지 NAS 를 빌려줌. **친구 NAS → Proxmox VE → Ubuntu VM** 안에 옮김. 월 0원.
>
> **왜 Tailscale Funnel 로 갔나** — GCP 에선 nginx + Let's Encrypt(certbot) 로 HTTPS 처리했음. 친구 NAS 환경에선 친구 공유기 포트 포워딩을 건드리고 싶지 않았고, certbot 갱신 세팅도 부담. Tailscale Funnel 은 `sudo tailscale funnel --bg 8080` **한 줄로 인증서 발급 + 자동 갱신 + 외부 노출** 다 해결. 셋업 30분 짜리가 5초로 끝남.
>
> **왜 Docker 안 썼나** — 시놀로지 DSM 의 Container Manager (Docker Compose) 가 옵션이었지만, 백엔드 1개 + DB 1개 짜리 시스템에 컨테이너 격리는 과잉. `bash start.sh + nohup` 으로 GCP 시절 방식 그대로 — `tail -f nohup.out` 한 줄로 로그 확인, `bash start.sh` 한 줄로 재시작. 디버깅이 압도적으로 단순.
>
> **결과** — 호스팅 비용 0원 / 외부 노출 5초 셋업 / 운영 환경 GCP 시절과 99% 동일 (재학습 비용 0).

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
    <td align="center">GCP VM (월 ~$30 무료크레딧)</td>
    <td align="center">친구 Synology NAS · Proxmox VE · Ubuntu VM (월 0원)</td>
  </tr>
  <tr>
    <td align="center"><b>외부 노출</b></td>
    <td align="center">nginx + certbot (Let's Encrypt)</td>
    <td align="center">Tailscale Funnel 한 줄 (<code>sudo tailscale funnel --bg 8080</code>)</td>
  </tr>
  <tr>
    <td align="center"><b>도메인</b></td>
    <td align="center">popspot.duckdns.org</td>
    <td align="center">vm-113.tailc57dd4.ts.net (Funnel) · popspot.co.kr (Vercel)</td>
  </tr>
  <tr>
    <td align="center"><b>배포 방식</b></td>
    <td align="center"><code>bash start.sh</code> + <code>nohup</code> (GCP VM)</td>
    <td align="center"><code>start.sh</code> 유지 + systemd <code>EnvironmentFile=</code> 로 env 주입</td>
  </tr>
  <tr>
    <td align="center"><b>실행 환경</b></td>
    <td align="center">Spring Boot 3.x · PostgreSQL 14</td>
    <td align="center">Spring Boot 4.0.2 · PostgreSQL 14 · Redis 6</td>
  </tr>
</table>

<br/>

### v1.3 — 음악·자동수집·등급

> **프로젝트 인생에서 가장 큰 방향 전환.** 결제 페이지 (POP-PASS 멤버십 + 메이트 확성기) 통째 폐기 → 음악 매칭을 코어 가치로.
>
> **왜 결제를 폐기했나**
> - 사이드 프로젝트 단계에서 결제는 **운영 책임 (환불 처리 · 세금계산서 · 소비자보호법)** 이 너무 크다
> - 사용자가 팝업 정보 보러 왔는데 결제창이 뜨는 것 자체가 가치 제안과 어긋남
> - 포트폴리오에서 "왜 굳이 결제?" 질문 받았을 때 답이 약했음
>
> **왜 음악이었나** — "오늘 어떤 팝업에 갈지" 정할 때 듣고 있는 노래가 가장 강한 입력값. 매일 자연스럽게 하는 행동이라 진입 장벽 0. 다른 팝업 정보 앱에 없는 차별점.
>
> **음악 검색 — Spotify 5단계 한국어 폴백**
> Spotify Web API 가 메인. "아이유 좋은날" 같은 한국어 검색이 잘 안 잡혀서 Groq 가 영문 표기로 변환 ("IU good day") 후 재시도. 5단계 (한글 그대로 → 영문 변환 → 아티스트만 → 곡명만 → YouTube 폴백) 폴백 체인.
>
> **음악 재생 — YouTube IFrame**
> Spotify Preview 는 30초만 들려줌. 풀 재생은 Premium API 가 필요한데 개인 개발자는 못 씀. **YouTube IFrame 으로 풀곡 재생**, 약관 III.E.4.b 에 따라 영상 화면을 보이게 노출 (오디오 분리 사용 X). quota 10,000/day 짜리라 한 번 매칭된 영상 ID 는 **영구 캐시**해서 재호출 0.
>
> **무드 매칭 — Groq 가 40 화이트리스트 안에서만**
> AI 가 자유 응답하면 "여름밤" / "한여름밤" / "여름의 밤" 같은 변형이 무한 → 매칭이 비결정적. **40 개 고정 키워드 안에서 정확히 5개 고르도록 강제** → 결정적 매칭. 키워드 1개 = 30점, 카테고리 보너스 더해서 상위 5개 팝업 반환. 외부 API 호출 0회, DB 만 사용.
>
> **자동수집 V4 — 매일 새벽 4시**
> 60 키워드 × (Naver 블로그·뉴스 + Kakao 웹·블로그 각 30건) × 800ms rate limit. Groq 가 검색 API 가 주는 title/desc/link 만 보고 구조화 (본문 직접 크롤링은 저작권법 위배). **confidence ≥ 0.8 자동 게시, 미만은 admin 검수**. 풀크롤 ~5분, 사용자 트래픽 시간대 완전 회피.
>
> **등급 시스템** — 결제 보상 (확성기) 사라진 자리를 채움. BEGINNER (3 스탬프) / HUNTER (6) / MASTER (12). 진행도 표시 + 색상 ring.

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
    <td align="center">팝업 정보 + 상점(PortOne 결제)</td>
    <td align="center">팝업 + <b>음악 → 팝업 매칭</b> (상점 폐기, <code>/shop → /music</code> 리다이렉트)</td>
  </tr>
  <tr>
    <td align="center"><b>음악 검색</b></td>
    <td align="center">없음</td>
    <td align="center">Spotify Web API · 한국어 5단계 폴백 (Groq 영문 변환 포함)</td>
  </tr>
  <tr>
    <td align="center"><b>음악 재생</b></td>
    <td align="center">없음</td>
    <td align="center">YouTube IFrame · lazy fetch + 영구 캐시 (quota 절약)</td>
  </tr>
  <tr>
    <td align="center"><b>매칭 알고리즘</b></td>
    <td align="center">없음</td>
    <td align="center">Groq 무드 분석(40 화이트리스트) → 30점 키워드 + 카테고리 보너스</td>
  </tr>
  <tr>
    <td align="center"><b>자동수집</b></td>
    <td align="center">없음 (수동 관리만)</td>
    <td align="center">V4 — Naver/Kakao 검색 API → Groq 정규화 → confidence ≥ 0.8 자동 게시</td>
  </tr>
  <tr>
    <td align="center"><b>지오코딩</b></td>
    <td align="center">없음</td>
    <td align="center">Kakao Local API → lat/lng</td>
  </tr>
  <tr>
    <td align="center"><b>스케줄러</b></td>
    <td align="center">없음</td>
    <td align="center">매일 04:00 자동수집 · 05:00 만료 처리 (KST)</td>
  </tr>
  <tr>
    <td align="center"><b>리워드</b></td>
    <td align="center">메이트 확성기 등 소모성 보상</td>
    <td align="center">BEGINNER / HUNTER / MASTER 3단계 등급 + 진행도</td>
  </tr>
  <tr>
    <td align="center"><b>DB 마이그레이션</b></td>
    <td align="center">V1~V3</td>
    <td align="center">V4 (popup_store +11 컬럼) · V5 (music_track) · V6 (spotify_track_id)</td>
  </tr>
</table>

<br/>

### v1.4 — 백엔드 Clean Code 정리

> **기능은 그대로 두고 코드 품질만 정리한 단계. 외부 동작 (API 응답·DB 스키마·Redis 키) 100% 동일.**
>
> **왜 했나** — 기능 빨리 만들다 보니 코드에 다음 같은 빚이 쌓여 있었다:
> - `import jakarta.persistence.*` 같은 와일드카드 import 가 JPA `@Table` vs Spring Data `@Table` 같은 잘못 import 사고를 가림
> - `// 🔥 [13번 임의 수정] 닉네임 빈칸 가입 방지` 같은 작업 흔적이 코드 곳곳에 박혀 있어서 다른 사람이 보면 진입 장벽
> - `setInterval(fetch, 3000)`, `BCrypt strength = 12` 같은 매직 넘버가 5군데 6군데 흩어져 있어서 정책 변경 시 사고 위험
> - `processOrder()` 가 130 줄 짜리라 결제 검증 + 위변조 방어 + 환불을 한 함수에 — 한 부분 고치다 다른 곳 깨질 위험
>
> **어떻게 했나** — 7 Wave 로 영역을 끊어서 진행. 한 PR 에 48 파일은 review 불가능이라 영역별로 1 PR.
>
> **7 Wave 단위**
> 1. `build.gradle` — Spotless 플러그인 (`googleJavaFormat('1.17.0').aosp()`) 활성화. 이후 모든 파일이 자동 포맷
> 2. 음악 서비스 7 파일 (SpotifySearch, MusicQueryNormalization 등)
> 3. 자동수집 크롤러 8 파일 (Orchestrator, Normalization, Naver/Kakao 등)
> 4. Controller 25 파일 — 와일드카드 import 제거, ResponseEntity 일관성
> 5. 일반 Service 16 파일 — `processOrder()` 130줄 → 7단계 분해, `runOnce()` → 6단계
> 6. Entity 핵심 6 (User, PopupStore, MatePost, Stamp, Orders, MyCourse)
> 7. Config / Exception 9 (Security, JWT Filter, WebSocket, RateLimit 등)
>
> **공통 원칙** — 와일드카드 import 전면 제거 / 인라인 한국어 코멘트 제거 (JavaDoc 만 유지) / 매직 넘버 `static final` 상수화 / `System.out.println` → SLF4J / 50줄+ 메서드 분해 / 운영 로그·코드에서 이모지 제거.
>
> **보강 작업** — 7 Wave 가 비킨 DTO 폴더 15개 + 잔여 엔티티 7개 도 같은 원칙으로 추가 정리.
>
> **결과** — 48 + 22 (보강) = 70 파일, 약 3,700 라인 변경. **API 응답·DB 스키마·Redis 키 모두 동일**. Spotless 자동 포맷 + 컴파일 통과로 회귀 위험 0.

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
    <td>build.gradle — Spotless 플러그인, <code>googleJavaFormat('1.17.0').aosp()</code> 강제</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 2</b></td>
    <td>음악 서비스 7 파일 — SpotifySearch, MusicQueryNormalization, SearchSuggest, Mood 등</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 3</b></td>
    <td>자동수집 크롤러 8 파일 — Orchestrator/Normalization/Naver/Kakao/Scheduler 분리</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 4</b></td>
    <td>Controller 25 파일 — 와일드카드 import 제거, ResponseEntity 일관성</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 5</b></td>
    <td>일반 Service 16 파일 — <code>processOrder()</code> 7단계 분해 등 거대 메서드 해체</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 6</b></td>
    <td>Entity 핵심 6 — User, PopupStore(V4 필드 포함), MatePost, Stamp, Orders, MyCourse</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 7</b></td>
    <td>Config / Exception 9 — Security, JWT Filter, WebSocket, RateLimit, GlobalExceptionHandler</td>
  </tr>
  <tr>
    <td align="center"><b>보강</b></td>
    <td>DTO 15 + 잔여 엔티티 7 — Wave 가 비킨 영역까지 동일 원칙 적용 (와일드카드 import 0건 · 인라인 코멘트 0건)</td>
  </tr>
</table>

<sub><b>공통 원칙</b> — 와일드카드 import 전면 제거 · 인라인 주석 제거 (JavaDoc 만 유지) · 매직 넘버 <code>static final</code> 상수화 · <code>System.out.println</code> → SLF4J · 50줄 넘는 메서드 분해 · 운영 로그·코드에서 이모지 제거. 48 + 22 (보강) 파일 · 약 3,700 라인. API · DB 스키마 · Redis 키 동등.</sub>

<br/>

### v1.5 — 프론트엔드 Clean Code 정리

> **백엔드 v1.4 가 끝나니 프론트가 그대로 방치된 게 더 거슬려서 같은 작업.** 7 Wave 중 위험도 낮은 5 Wave (1·2·3·4·7) 만 우선 적용. 인프라 동일.
>
> **Wave 1 — 작업 흔적 84건 일괄 제거 (21 파일)**
> `// 🔥 [수정] apiFetch 사용`, `// 🔥 [13번 임의 수정] 닉네임 빈칸 가입 방지`, `{/* 🟢 [수정 핵심] Portal 사용 */}` 같은 코드 곳곳의 마커 84건. git 히스토리에 있는 정보를 코드 안에 박아두면 노이즈만 됨. sed 일괄 변환 + 잔존 5건 수동 정리. UI 텍스트의 의도된 이모지 1건 (`"🔥 확성기로 등록하기"`) 만 유지.
>
> **Wave 2 — `any` 타입 17건 → SDK 경계 1건**
> 가장 임팩트 큰 작업. `any` 는 컴파일러 안전망 무효화 — 잠재 버그가 빌드를 통과하고 런타임에 터짐. 도메인 타입 (`User`, `PopupStore`, `CongestionData`, `YouTubePlayer` 등) 으로 좁힘. 외부 SDK (Kakao Maps · YouTube IFrame) 는 `src/types/sdk.ts` 한 곳에 모아 `eslint-disable` + 사유 코멘트로 격리. **이 작업이 실제로 잠재 버그 1건 발견** (v1.5.1 참조).
>
> **Wave 3 — API 호출 일원화**
> `app/login/page.tsx:89` 의 `const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"` 같은 인라인 폴백 제거. `src/lib/api.ts` 의 `API_BASE_URL` 이 이미 같은 폴백 로직을 가지고 있는데 여기서 또 중복. 한 군데서 환경변수 이름 바꾸면 다른 곳이 조용히 옛 값을 따라가던 위험 제거.
>
> **Wave 4 — 매직 넘버 명명 상수화 (8건)**
> `setInterval(fetchMetrics, 3000)` 의 `3000` 이 왜 3초인지 코드만 보면 모름. 다음 사람이 "100ms 로 더 빠르게" 라고 무심코 바꾸면 백엔드 부하. `const SERVER_METRICS_POLL_INTERVAL_MS = 3000` 으로 의도 + 단위 명시. `AUTH_SUCCESS_REDIRECT_MS`, `TICKETING_POLL_INTERVAL_MS`, `COUNTDOWN_TICK_MS` 등.
>
> **Wave 7 — ESLint disable 사유 명시 + 진짜 위험 1건 정공법 해결**
> 8건 모두 사유 코멘트 추가 — `// Spotify/iTunes CDN 이미지 — next/image 도메인 화이트리스트 대신 <img> 사용` 식. 그 중 `intro/page.tsx` 의 `react-hooks/exhaustive-deps` disable 은 진짜 stale closure 위험이었음 → 핸들러 로직 인라인 + deps 정리로 정공법 해결.
>
> **의도적으로 미룬 것 — Wave 5·6**
> 거대 컴포넌트 분해 (`app/page.tsx` 1,289 라인 / useState 22개) + Tailwind variant 추출 (200자+ className 60군데) 은 회귀 검출 수단 (E2E 테스트) 이 없어 deferred. 한 번에 다 하면 review 불가능 + 회귀 검출 0. E2E 스모크 셋업 후 1 파일 = 1 PR 로 진행 예정.
>
> **결과** — 40 파일 · 약 ±230 라인 변경 (대부분 삭제). 외부 동작 · API 호출 · WebSocket 메시지 형식 모두 동일.

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
    <td>편집 흔적 일괄 제거 — 21 파일에서 <code>🔥 [수정]</code>, <code>[임의 수정]</code>, <code>🟢 [수정 핵심]</code> 등 84건 → 1건 (UI 의도)</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 2</b></td>
    <td>타입 안전성 — <code>any</code> 17건 → SDK 경계 1건. 신규 <code>src/types/sdk.ts</code> — Kakao Maps / YouTube IFrame 타입 격리</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 3</b></td>
    <td>API 호출 일원화 — <code>app/login/page.tsx</code> 의 하드코딩 <code>localhost:8080</code> 폴백 제거, <code>API_BASE_URL</code> 한 곳만 참조</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 4</b></td>
    <td>매직 넘버 상수화 — <code>SERVER_METRICS_POLL_INTERVAL_MS</code>, <code>AUTH_SUCCESS_REDIRECT_MS</code>, <code>TICKETING_POLL_INTERVAL_MS</code> 등 8건</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 7</b></td>
    <td>ESLint 정리 — disable 8건 모두 사유 코멘트, <code>intro/page.tsx</code> 의 exhaustive-deps 진짜 위험은 핸들러 인라인으로 정공법 해결</td>
  </tr>
  <tr>
    <td align="center"><b>Wave 5·6</b></td>
    <td><b>의도적 deferred</b> — 거대 컴포넌트 분해 (<code>app/page.tsx</code> 1,289 라인) + Tailwind variant 추출 60군데. E2E 회귀 셋업 후 별도 PR</td>
  </tr>
</table>

<sub><b>공통 원칙</b> — 편집 흔적 0건 (UI 의도 1건 제외) · <code>any</code> 0건 (SDK 경계 1건 제외) · 하드코딩 URL 0건 · 매직 넘버 명명 상수 · <code>console.log</code> 디버그 0건 · ESLint disable 사유 코멘트 필수. 40 파일 · 약 ±230 라인 (대부분 삭제). 외부 동작 · API · WebSocket 메시지 형식 동등.</sub>

<br/>

### v1.5.1 — 빌드 검증 + 핫픽스

> **v1.5 의 Wave 2 가 진짜 가치를 보여준 단계.** `any` → 도메인 타입 좁히기가 끝나자마자 TypeScript 컴파일러가 그동안 가려져 있던 **타입 불일치 16건**을 한꺼번에 토해냄. 즉, **컴파일러가 잠재 버그를 미리 잡아준 것** — Wave 2 가 없었으면 사용자 화면에서 런타임 에러로 터졌을 케이스들.
>
> **가장 큰 발견 — `?userId=undefined` 잠재 버그**
> `const targetUserId = user.userId || user.id` 가 둘 다 옵셔널이라 결과 타입이 `string | undefined`. 이전엔 `user: any` 였어서 컴파일러가 안 잡았는데, 도메인 타입 (`User`) 으로 좁히니 빌드 단계에서 발견. 둘 다 undefined 면 백엔드에 `POST /api/mates/{id}/join?userId=undefined` 같은 요청이 갔을 거. **early-return + notify 가드로 차단**. → "v1.5 의 Wave 2 자체가 회귀 테스트보다 더 안정적인 안전망" 이라는 걸 입증.
>
> **다른 6가지 패턴 — 모두 외부 동작 변화 0건으로 수정**
> 1. **이름 충돌** — lucide-react 의 `User` 아이콘 ↔ 도메인 `User` 타입이 같은 식별자라 빌드 실패. `User as UserIcon` / `User as DomainUser` alias 로 의도를 명시
> 2. **null 가드** — `app/page.tsx` 의 `user` 가 `User | null` 인데 MateBoard 가 non-null 요구. JSX 에서 `{user && <MateBoard user={user} />}` 가드. 컴포넌트 내부 invariant ("user 는 반드시 있다") 가 깔끔해짐
> 3. **도메인 타입 필드 보강** — `User.id/megaphoneCount`, `PopupStore.reporterId/description/imageUrl`, `CongestionData.areaName/forecasts` 등 추가 (모두 optional + JavaDoc 으로 "어떤 백엔드 케이스에서 들어오는지" 명시)
> 4. **인덱스 시그니처 제거** — `AdminStats` 의 `[key: string]: unknown` 이 "모름의 표현" 으로 안전망인 줄 알았는데, JSX 에서 `{stats.activePopups}` 렌더할 때 `unknown → ReactNode` 변환 거부. 실제 사용 필드만 명시하니 컴파일러가 백엔드 응답 변경을 잡아주는 안전망으로 바뀜
> 5. **Recharts formatter 시그니처 정정** — `(value: number | string) => ...` 로 좁혔는데 라이브러리는 `ValueType | undefined`. 시그니처 inferred 로 풀고 내부에서 `typeof === 'number'` 분기. 이전엔 `value.toLocaleString()` 이 string 케이스에서 런타임 TypeError 였을 가능성
> 6. **error 가드** — `catch (error: any) { error.message }` 가 throw 된 게 Error 인스턴스가 아닐 때 `undefined` 찍히던 거. `catch (error) { error instanceof Error ? ... : String(error) }` 패턴으로 통일
>
> **트러블슈팅 — 샌드박스 mount 캐시 버그**
> 본 작업 중 Windows ↔ Linux mount 사이 cache coherency 버그로 일부 파일 끝에 NULL byte (`\x00`) 가 패딩되거나 캐시된 옛 view 가 보이는 사고. `xxd` 로 NULL trail 검사 후 `truncate`, 손상 부분은 Edit tool 로 재작성. admin/page.tsx 의 중복 닫는 태그 6줄은 사용자 PC 의 `npm run typecheck` 가 잡아내서 정리.
>
> **클린코드 원칙 — 100% 유지 확인**
> 패치 7개 모두 외부 동작 변화 0건. 와일드카드 import 0 · 인라인 한국어 코멘트 0 · `System.out` 0 · `console.log` 디버그 0 · `any` 0 (SDK 경계 1 제외) · 편집 흔적 0 (UI 의도 1 제외).

<table align="center">
  <tr>
    <th align="center" width="180">패턴</th>
    <th align="center" width="400">증상 · 수정</th>
  </tr>
  <tr>
    <td align="center"><b>이름 충돌</b></td>
    <td>lucide-react <code>User</code> 아이콘 ↔ 도메인 <code>User</code> 타입 → <code>User as UserIcon</code> / <code>User as DomainUser</code> alias</td>
  </tr>
  <tr>
    <td align="center"><b>Null 가드</b></td>
    <td><code>User | null</code> 을 non-null prop 으로 → JSX 에서 <code>{user && &lt;MateBoard user={user} /&gt;}</code></td>
  </tr>
  <tr>
    <td align="center"><b>도메인 타입 보강</b></td>
    <td><code>User.id/megaphoneCount</code> · <code>PopupStore.reporterId/description/imageUrl</code> · <code>CongestionData.areaName/forecasts</code> 추가 (모두 optional + JavaDoc 사유)</td>
  </tr>
  <tr>
    <td align="center"><b>인덱스 시그니처 제거</b></td>
    <td><code>AdminStats</code>, <code>AdminMatePost</code> 의 <code>[key: string]: unknown</code> 제거 — JSX 에서 <code>unknown → ReactNode</code> 막힘. 실제 필드만 명시</td>
  </tr>
  <tr>
    <td align="center"><b>Recharts 시그니처</b></td>
    <td>Tooltip formatter <code>value</code> 타입 — 라이브러리 표준에 맞춰 inferred, 내부에서 <code>typeof === 'number'</code> 좁힘</td>
  </tr>
  <tr>
    <td align="center"><b>error 가드</b></td>
    <td><code>catch (error: any)</code> → <code>catch (error)</code> + <code>instanceof Error</code> 분기 (Wave 2 일관 패턴)</td>
  </tr>
  <tr>
    <td align="center"><b>잠재 버그 발견</b></td>
    <td><code>targetUserId = user.userId || user.id</code> 가 <code>undefined</code> 일 때 <code>?userId=undefined</code> 로 API 호출되던 버그 — empty fallback + early return 으로 차단</td>
  </tr>
</table>

<sub><b>검증</b> — 백엔드 <code>./gradlew compileJava spotlessCheck</code> ✓ · 프론트 <code>npm run typecheck</code> ✓ (16건 → 0). 와일드카드 import 0 · 인라인 한국어 코멘트 0 · <code>System.out</code> 0 · <code>console.log</code> 디버그 0 · <code>any</code> 0 (SDK 경계 1 제외) · 편집 흔적 0 (UI 의도 1 제외) — 모두 유지.</sub>

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
