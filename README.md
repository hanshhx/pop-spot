<div align="center">

# POP-SPOT

성수동 팝업스토어 검색 · 자동수집 · 음악 매칭 서비스

**[popspot.co.kr](https://popspot.co.kr/)**

[![Java](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring](https://img.shields.io/badge/Spring_Boot-4.0-6DB33F?logo=springboot&logoColor=white)](https://spring.io/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
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
    <th colspan="6" align="center">Data Layer</th>
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
    <th colspan="6" align="center">External APIs</th>
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

## 버전별 시스템 아키텍처

각 버전이 어떻게 생겼었고, 다음 버전에서 무엇이 잘려나갔는지 그림으로 정리한다.
아키텍처가 바뀌지 않은 항목은 표기하지 않았다.

<br/>

### v1.0 — 첫 배포

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
      <img src="https://cdn.simpleicons.org/amazonec2/FF9900" width="34"/><br/>
      <b>AWS EC2</b><br/>
      <sub>Spring Boot</sub>
    </td>
    <td align="center" width="20">+</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/h2database/1021FF" width="34"/><br/>
      <b>H2</b><br/>
      <sub>in-memory</sub>
    </td>
    <td align="center" width="20">+</td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/googlegemini/8E75B2" width="34"/><br/>
      <b>Gemini</b><br/>
      <sub>정규화</sub>
    </td>
  </tr>
</table>

<sub><b>그땐 이랬다</b> — 시크릿은 <code>application.properties</code> 에 평문 커밋, <code>CORS *</code> 전부 허용, JWT 시크릿은 <code>"default_secret"</code>. H2 in-memory 라 재배포 한 번이면 데이터 0. Gemini 무료 200/일. BCrypt strength 기본값(10). 외부 트래픽은 EC2 8080 노출.</sub>

<br/>

### v1.1 — 보안 정비 + AI 교체 

> OWASP Top 10 한 번 훑고, AI 한도 부족해서 Groq 으로 갈아탔다.

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
    <td align="center">H2 in-memory</td>
    <td align="center">PostgreSQL + Flyway (validate)</td>
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
    <td align="center">Gemini (200/일)</td>
    <td align="center">Groq llama-3.3-70b (≈14,400/일)</td>
  </tr>
  <tr>
    <td align="center"><b>검색</b></td>
    <td align="center">Postgres <code>ILIKE</code> (≈3s)</td>
    <td align="center">Algolia (≈200ms)</td>
  </tr>
</table>

<br/>

### v1.2 — 집서버 이전 + nginx 제거

> GCP 무료 크레딧이 5/28 만료. 친구 NAS 빌려서 옮겼다. 옮기면서 nginx 도 같이 뺐다.

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
    <td align="center">Tailscale Funnel 한 줄 (<code>tailscale funnel 8080</code>)</td>
  </tr>
  <tr>
    <td align="center"><b>도메인</b></td>
    <td align="center">popspot.duckdns.org</td>
    <td align="center">vm-113.tailc57dd4.ts.net (Funnel) · popspot.co.kr (Vercel)</td>
  </tr>
  <tr>
    <td align="center"><b>배포 방식</b></td>
    <td align="center">Docker compose</td>
    <td align="center">systemd 로 직접 기동 (디버깅 단순화)</td>
  </tr>
  <tr>
    <td align="center"><b>실행 환경</b></td>
    <td align="center">Spring Boot 3.x · PostgreSQL 14</td>
    <td align="center">Spring Boot 4.0.2 · PostgreSQL 14 · Redis 6</td>
  </tr>
</table>

<br/>

### v1.3 — 음악·자동수집·등급 

> 결제(상점) 폐기 → 음악으로 코어 가치 교체. 동시에 자동수집 V4 + 등급 시스템 투입.
> 인프라는 v1.2 와 동일, 서비스 레이어만 두꺼워졌다.

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
      <sub>Next.js 14</sub>
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
      <img src="https://cdn.simpleicons.org/redis/DC382D" width="30"/>
      <img src="https://cdn.simpleicons.org/algolia/003DFF" width="30"/><br/>
      <sub>PG · Redis · Algolia</sub>
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

> 외부 동작은 100% 동일. 내부 코드만 7 Wave 에 걸쳐 갈았다. 회귀 테스트로 동등성 검증.

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
</table>

<sub><b>공통 원칙</b> — 와일드카드 import 전면 제거 · 인라인 주석 제거 (JavaDoc 만 유지) · 매직 넘버 <code>static final</code> 상수화 · <code>System.out.println</code> → SLF4J · 50줄 넘는 메서드 분해 · 운영 로그·코드에서 이모지 제거. 48개 파일 · 약 3,500 라인. API · DB 스키마 · Redis 키 동등.</sub>

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
| 1 | `LazyInitializationException` 갑자기 터짐 | EAGER → LAZY + fetch join |
| 2 | PostgreSQL ILIKE 한글 검색 3초 | Algolia 붙여서 200ms |
| 3 | Spotify 가 "아이유 좋은날" 못 찾음 | Groq 로 영문 표기 변환 ("IU good day") |
| 4 | application-prod.properties 우선순위 함정 | 외부 파일 → 환경변수만 사용 |
| 5 | Gemini 키 GitHub 노출 → 자동 차단 | 시크릿 스캔 GitHub Action 추가 |

---

## TODO

- [ ] iOS / Android 네이티브 (Capacitor 검토)
- [ ] 팝업 이미지 OCR — 자동수집 정확도 더 올리기
- [ ] AI 어시스턴트 — 사용자 취향 학습
- [ ] 단위 테스트 커버리지 50%+ (지금 10%)
- [ ] 시놀로지 NAS 이전 마무리

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
| `GROQ_API_KEY` · `GROQ_MODEL_NAME` | LLM (정규화 · 무드 분석) | 기본 모델 `llama-3.3-70b-versatile` |
| `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` | 검색 API + OAuth2 | 두 용도 동일 키 |
| `KAKAO_REST_API_KEY` · `KAKAO_LOCAL_API_KEY` | 검색 / 지오코딩 | |
| `SPOTIFY_CLIENT_ID` · `SPOTIFY_CLIENT_SECRET` | Spotify Web API | Client Credentials |
| `YOUTUBE_API_KEY` | YouTube Data API v3 | quota 절약 위해 lazy fetch |
| `ALGOLIA_APP_ID` · `ALGOLIA_API_KEY` · `ALGOLIA_INDEX` | 한글 검색 | 잘못된 키면 안전 fallback |
| `IAMPORT_API_KEY` · `IAMPORT_API_SECRET` | PortOne 결제 검증 | 상점 폐기 후 미사용, 호환만 유지 |
| `SENTRY_DSN` | 에러 모니터링 | 운영만 |
| `CORS_ALLOWED_ORIGINS` | 패턴 화이트리스트 | 예: `https://popspot.co.kr,https://*.vercel.app` |
| `OAUTH_GOOGLE_CLIENT_ID/SECRET` | Google OAuth2 | |
| `OAUTH_KAKAO_CLIENT_ID/SECRET` | Kakao OAuth2 | |
| `OAUTH_NAVER_CLIENT_ID/SECRET` | Naver OAuth2 | |

### 프론트엔드 (`popspot-frontend/.env.local`)

| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | 백엔드 REST 베이스 (예: `https://vm-113.tailc57dd4.ts.net`) |
| `NEXT_PUBLIC_SOCKET_BASE_URL` | STOMP 엔드포인트 (없으면 API 호스트로 폴백) |
| `NEXT_PUBLIC_ALGOLIA_APP_ID` · `NEXT_PUBLIC_ALGOLIA_SEARCH_KEY` · `NEXT_PUBLIC_ALGOLIA_INDEX` | 클라이언트 검색 |
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
├── popspot-frontend/     Next.js 14 · TypeScript · Tailwind
├── ARCHITECTURE.md       시스템 구성도 (상세)
├── PROJECT_CHANGELOG.md  버전별 변경 이력 (~5000 줄)
└── SYNOLOGY_MIGRATION_GUIDE.md
```

## 만든 사람

**동현** · 디자인 도움 [@hanshhx](https://github.com/hanshhx)

문의 / 버그 제보는 GitHub Issues 로.

<div align="center">
<sub>Made with coffee in Seoul</sub>
</div>
