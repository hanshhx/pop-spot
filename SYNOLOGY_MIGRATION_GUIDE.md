# POP-SPOT 시놀로지 마이그레이션 가이드

> GCP VM (만료 2026-05-28) → 친구 시놀로지 NAS 이전
> 작성일: 2026-04-29

---

## 📋 목차

1. [현재 GCP VM 상태](#1-현재-gcp-vm-상태)
2. [옮길 파일 체크리스트](#2-옮길-파일-체크리스트)
3. [친구한테 먼저 받을 정보](#3-친구한테-먼저-받을-정보)
4. [전송 방법 비교 & 선택](#4-전송-방법-비교--선택)
5. [실전 절차 — 방법 A (rsync 직접)](#5-실전-절차--방법-a-rsync-직접)
6. [실전 절차 — 방법 B (SFTP via PC)](#6-실전-절차--방법-b-sftp-via-pc)
7. [시놀로지에서 띄우기 (Docker Compose)](#7-시놀로지에서-띄우기-docker-compose)
8. [DB 복원 절차](#8-db-복원-절차)
9. [도메인 / SSL / 외부 접속](#9-도메인--ssl--외부-접속)
10. [최종 검증 체크리스트](#10-최종-검증-체크리스트)
11. [트러블슈팅](#11-트러블슈팅)

---

## 1. 현재 GCP VM 상태

### 시스템 스펙
- **OS**: Ubuntu 22.04.5 LTS (kernel 6.8.0-1047-gcp)
- **CPU**: 2 vCPU
- **RAM**: 958 MiB (≈ 1 GB) + Swap 2 GB
- **디스크**: 29 GB 중 13 GB 사용 (43 %), 17 GB 여유
- **외부 IP**: 34.121.111.208
- **SSH 사용자**: `reo4321`
- **도메인**: popspot.duckdns.org (Let's Encrypt 인증서 발급됨)

### 실행 중인 서비스

| 서비스 | 버전 | 포트 | 비고 |
|---|---|---|---|
| Spring Boot (Java) | OpenJDK 21.0.10 | 8080 | popspot-backend-0.0.1-SNAPSHOT.jar |
| PostgreSQL | 14.22 | 5432 | DB 데이터 약 68 MB |
| Redis | 6.0.16 | 6379 | 캐시 ~900 KB |
| nginx | 1.18.0 | 80 / 443 | 리버스 프록시 + SSL |

### 디렉토리 사용량

```
/var                  7.5 GB   ← 시스템 로그/패키지 (이전 ❌)
/home                 184 MB
/opt                  424 MB
/etc                  7.5 MB
/var/lib/postgresql   68 MB    ← DB 데이터 (덤프로 이전)
/var/lib/redis        8 KB     ← 휘발성 (이전 ❌)
```

---

## 2. 옮길 파일 체크리스트

### ✅ 반드시 옮겨야 할 것 (총 ~200 MB)

| 항목 | 위치 | 크기 | 비고 |
|---|---|---|---|
| **DB 덤프** | `pg_dumpall` 로 생성 | ~70 MB | 가장 중요 |
| 백엔드 JAR (최신) | `/home/reo4321/popspot-backend-0.0.1-SNAPSHOT.jar` | 92 MB | Apr 28 빌드본 |
| 환경변수 | `/home/reo4321/popspot.env` | 3 KB | API 키들 |
| 시작 스크립트 | `/home/reo4321/start.sh` | 4 KB | |
| 운영 설정 | `/home/reo4321/application-prod.properties` | 4 KB | |
| 사용자 업로드 | `/home/reo4321/uploads/` | 1.7 MB | 이미지 등 |
| nginx 설정 | `/etc/nginx/sites-available/default` | 작음 | popspot 라우팅 포함 |
| (선택) SSL 인증서 | `/etc/letsencrypt/live/popspot.duckdns.org/` | 작음 | 새로 발급 추천 |

### ❌ 옮기지 말 것 (불필요)

| 항목 | 사유 |
|---|---|
| `popspot-backend-0.0.1-SNAPSHOT_(1).jar` (88 MB) | Feb 19 구버전 |
| `nohup.out` (3.1 MB) | 단순 로그 |
| `popspot.log` | 단순 로그 |
| Redis 데이터 | 캐시(휘발성), 새로 채워짐 |
| `/var` 시스템 파일 | 시놀로지 OS 가 별도 |

### ✅ 확인된 DB 정보

| 항목 | 값 |
|---|---|
| **DB 이름** | `popspot_db` |
| **사용자** | `popspot_user` |
| **비밀번호** | `1234` ⚠️ **시놀로지 이전 전 변경 필수** |
| **인코딩** | UTF8 / C.UTF-8 |
| **포트** | 5432 |

### 🚨 시놀로지 이전 전 보안 작업 (필수)

비밀번호 `1234` 는 다음 이유로 **반드시 변경**해야 합니다:
- 친구도 시놀로지 SSH 접속 시 `popspot.env` 평문 비번 노출
- 자동화 봇이 1초 안에 뚫는 비번 — 5432 포트 노출 시 즉시 탈취
- pg_dump 파일에도 권한 정보 포함

```bash
# (1) 강한 비번 생성
openssl rand -base64 32
# 결과 예시: aB3f9JK2xNqW8mP5vY7tR1sU0eHc4dGlZ6oQiWnX

# (2) Postgres 비번 변경
sudo -u postgres psql -c "ALTER USER popspot_user WITH PASSWORD '위에서_생성한_비번';"

# (3) popspot.env 의 DB_PASSWORD 도 동일하게 수정
nano /home/reo4321/popspot.env
# DB_PASSWORD=새비번

# (4) 백엔드 재시작 후 동작 확인
sudo systemctl restart popspot   # (본인의 재시작 절차)
curl http://localhost:8080/actuator/health
```

### ⚠️ 추가로 확인할 것

```bash
# nginx 실제 설정 (sites-enabled 에 default 만 있는데 SSL 은 잡혀있음 → default 안에 popspot 라우팅 들어있을 가능성)
sudo cat /etc/nginx/sites-available/default
```

---

## 3. 친구한테 먼저 받을 정보

마이그레이션 전에 아래 4가지를 꼭 받으세요.

| 항목 | 예시 | 왜 필요한가 |
|---|---|---|
| 시놀로지 **모델명** | DS220+ / DS923+ 등 | CPU 아키텍처 (x86_64 / ARM) |
| **RAM** 용량 | 2 GB / 4 GB / 8 GB | RAM < 2 GB 면 다른 전략 필요 |
| **외부 IP** 또는 DDNS | `친구.synology.me` | rsync/SSH 접속용 |
| **SSH 활성화** 가능 여부 | DSM → 제어판 → 터미널 | rsync 직접 전송용 |
| 시놀로지 **사용자 ID** | `admin` / 별도 계정 | SSH 로그인용 |
| **포트포워딩** 가능한 포트 | 22, 80, 443, 8080 | 외부 접속용 |

> 💡 RAM 이 1 GB 미만이면 PostgreSQL + Redis + Spring Boot 동시 구동이 빡빡해요. 그땐 H2 (임베디드) 로 전환하거나 Redis 빼는 식의 다이어트가 필요합니다.

---

## 4. 전송 방법 비교 & 선택

| 방법 | 난이도 | 속도 | 추천도 | 사용 시나리오 |
|---|---|---|---|---|
| **rsync** (GCP → 시놀로지 직접) | 중 | 가장 빠름 | ⭐⭐⭐⭐⭐ | 시놀로지 SSH 가능할 때 |
| **SFTP via FileZilla** (PC 경유) | 하 | 느림 | ⭐⭐⭐ | SSH 못 켜거나 GUI 선호 |
| **scp** (PC 경유) | 하 | 느림 | ⭐⭐ | 명령줄 익숙할 때 |
| **FTP** | 하 | 보통 | ❌ | 평문 비번, 비추 |
| **Python 스크립트** | 상 | 보통 | ❌ | 불필요한 오버엔지니어링 |

**결론**:
- 친구가 SSH 켜줌 → **방법 A (rsync)**
- 친구가 SSH 안 켬 → **방법 B (SFTP via PC)**

---

## 5. 실전 절차 — 방법 A (rsync 직접)

### Step 1. 시놀로지 준비 (친구에게 부탁)

1. DSM → **제어판 → 터미널 및 SNMP → SSH 서비스 활성화** 체크
2. **제어판 → 사용자 → 권한** 에서 본인 계정에 `homes` 폴더 R/W 권한
3. **File Station** 에서 `popspot` 공유 폴더 새로 생성
4. (선택) 공유기에서 22 번 포트 → 시놀로지 IP 포트포워딩

### Step 2. GCP VM 접속 후 DB 덤프

```bash
ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208

# 진짜 DB 이름 확인
sudo -u postgres psql -l

# 전체 DB + 사용자 권한 같이 백업 (가장 안전)
sudo -u postgres pg_dumpall > ~/popspot_db_backup.sql

# 사이즈 확인
ls -lh ~/popspot_db_backup.sql
```

### Step 3. rsync 한 방에 전송

```bash
# GCP VM 에서 실행
rsync -avzP \
  ~/popspot-backend-0.0.1-SNAPSHOT.jar \
  ~/popspot.env \
  ~/start.sh \
  ~/application-prod.properties \
  ~/uploads/ \
  ~/popspot_db_backup.sql \
  시놀로지유저@시놀로지IP:/volume1/popspot/

# nginx 설정 (sudo 필요)
sudo rsync -avzP \
  /etc/nginx/sites-available/default \
  시놀로지유저@시놀로지IP:/volume1/popspot/nginx-default.conf

# Let's Encrypt 인증서 (참고용 백업, 새로 발급 추천)
sudo rsync -avzP \
  /etc/letsencrypt/live/popspot.duckdns.org/ \
  시놀로지유저@시놀로지IP:/volume1/popspot/letsencrypt-backup/
```

### Step 4. 전송 검증

```bash
# 시놀로지 SSH 접속 후
ssh 시놀로지유저@시놀로지IP

cd /volume1/popspot
ls -lah
# 모든 파일 사이즈가 GCP 와 똑같은지 확인
```

---

## 6. 실전 절차 — 방법 B (SFTP via PC)

### Step 1. GCP → 내 PC (PowerShell)

```powershell
# 작업 폴더 생성
cd ~\Downloads
mkdir popspot-migration
cd popspot-migration

# DB 덤프 먼저 GCP 에서 만들고
ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208 `
  "sudo -u postgres pg_dumpall > ~/popspot_db_backup.sql"

# 한 번에 다 받기
scp -i ~/.ssh/gcp_key reo4321@34.121.111.208:~/popspot-backend-0.0.1-SNAPSHOT.jar .
scp -i ~/.ssh/gcp_key reo4321@34.121.111.208:~/popspot.env .
scp -i ~/.ssh/gcp_key reo4321@34.121.111.208:~/start.sh .
scp -i ~/.ssh/gcp_key reo4321@34.121.111.208:~/application-prod.properties .
scp -i ~/.ssh/gcp_key reo4321@34.121.111.208:~/popspot_db_backup.sql .
scp -i ~/.ssh/gcp_key -r reo4321@34.121.111.208:~/uploads .

# nginx 설정
scp -i ~/.ssh/gcp_key reo4321@34.121.111.208:/tmp/nginx-default.conf .
# (GCP 에서 먼저 sudo cp /etc/nginx/sites-available/default /tmp/ && sudo chmod 644 /tmp/nginx-default.conf 필요)
```

### Step 2. 내 PC → 시놀로지 (FileZilla)

1. **FileZilla** 다운로드: https://filezilla-project.org
2. **사이트 관리자** → 새 사이트
   - 프로토콜: **SFTP - SSH File Transfer Protocol**
   - 호스트: `시놀로지IP` 또는 `친구.synology.me`
   - 포트: `22`
   - 로그온 유형: **일반**
   - 사용자: 시놀로지 ID
   - 비밀번호: 시놀로지 비번
3. 연결 → 오른쪽 창에서 `/volume1/popspot/` 이동
4. 왼쪽(내 PC) → 오른쪽(시놀로지) 드래그

> 💡 RDP / 화면공유 없이 친구가 DSM 웹에서 직접 업로드할 수도 있어요. 내 PC → DSM 웹 → File Station 업로드. 단 큰 파일은 시간이 오래 걸림.

---

## 7. 시놀로지에서 띄우기 (Docker Compose)

### Step 1. 시놀로지 Container Manager 설치

DSM → **패키지 센터** → "Container Manager" 검색 → 설치
(예전 이름: Docker. DSM 7.2+ 부터는 Container Manager)

### Step 2. `docker-compose.yml` 작성

`/volume1/popspot/docker-compose.yml` 로 저장:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: popspot-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      TZ: Asia/Seoul
    volumes:
      - ./pgdata:/var/lib/postgresql/data
      - ./popspot_db_backup.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: popspot-redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  backend:
    image: openjdk:21-slim
    container_name: popspot-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    working_dir: /app
    volumes:
      - ./popspot-backend-0.0.1-SNAPSHOT.jar:/app/app.jar:ro
      - ./uploads:/app/uploads
      - ./application-prod.properties:/app/application-prod.properties:ro
    env_file:
      - ./popspot.env
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB}
      SPRING_DATASOURCE_USERNAME: ${POSTGRES_USER}
      SPRING_DATASOURCE_PASSWORD: ${POSTGRES_PASSWORD}
      SPRING_DATA_REDIS_HOST: redis
      SPRING_DATA_REDIS_PORT: 6379
      TZ: Asia/Seoul
    ports:
      - "8080:8080"
    command: java -jar -Dspring.config.additional-location=/app/application-prod.properties /app/app.jar
```

### Step 3. `.env` 파일 통일

기존 `popspot.env` 의 DB 관련 값을 그대로 쓰되, Docker Compose 가 읽을 변수를 정리:

```bash
# /volume1/popspot/.env (Docker Compose 용)
POSTGRES_USER=popspot_user
POSTGRES_PASSWORD=새로_변경한_강한_비번
POSTGRES_DB=popspot_db
```

> 그리고 **`popspot.env`** 안의 `DB_URL` 도 시놀로지에선 호스트가 `localhost` 가 아닌 컨테이너 이름으로 바뀌어야 합니다:
> ```
> DB_URL=jdbc:postgresql://postgres:5432/popspot_db
> ```

### Step 4. 띄우기

```bash
ssh 시놀로지유저@시놀로지IP
cd /volume1/popspot

# 백그라운드 실행
sudo docker compose up -d

# 로그 확인
sudo docker compose logs -f backend
```

---

## 8. DB 복원 절차

`docker-compose.yml` 에 `init.sql` 마운트해뒀으면 **첫 기동 시 자동 복원** 됩니다. 수동으로 복원할 때:

```bash
# Postgres 컨테이너 안으로 들어가서
sudo docker exec -it popspot-postgres bash

# 복원
psql -U $POSTGRES_USER -d $POSTGRES_DB < /docker-entrypoint-initdb.d/init.sql

# 검증
psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT COUNT(*) FROM popup_store;"
```

> ⚠️ `pg_dumpall` 은 모든 DB + 권한을 함께 덤프합니다. 만약 단일 DB 만 받고 싶으면 GCP 에서 `pg_dump -U postgres popspot > popspot.sql` 식으로 별도 생성.

---

## 9. 도메인 / SSL / 외부 접속

### 9.1. DuckDNS 도메인 그대로 쓰기

DuckDNS 관리 페이지 (https://www.duckdns.org) 에서:
- **현재 IP**: `34.121.111.208` (GCP)
- **변경**: 친구 집 외부 IP

> 친구 외부 IP 가 동적이면, 시놀로지에 DuckDNS 자동 갱신 스크립트를 cron 으로 돌려야 합니다.

### 9.2. 친구 공유기 포트포워딩

| 외부 포트 | → | 시놀로지 IP : 포트 | 용도 |
|---|---|---|---|
| 80 | → | 시놀로지:80 | HTTP (Let's Encrypt 인증) |
| 443 | → | 시놀로지:443 | HTTPS |

> 8080 (백엔드) 은 외부 노출 ❌, nginx 가 프록시.

### 9.3. SSL 인증서 (재발급 추천)

GCP 의 인증서를 그대로 옮기는 것보단, 시놀로지에서 새로 받는 게 깔끔합니다.

**옵션 1 — DSM 내장 Let's Encrypt** (제일 쉬움):
DSM → 제어판 → **보안 → 인증서 → 추가 → Let's Encrypt 인증서**
- 도메인: `popspot.duckdns.org`
- 이메일: 본인 이메일
- 자동 갱신 ✅

**옵션 2 — Reverse Proxy (DSM 내장)**:
DSM → 제어판 → **로그인 포털 → 고급 → 역방향 프록시**
- 원본: `popspot.duckdns.org` HTTPS 443
- 대상: `localhost` HTTP 8080

이거면 nginx 따로 안 띄워도 됨.

### 9.4. (대안) nginx 도커로 띄우기

기존 nginx 설정을 그대로 쓰고 싶으면 `docker-compose.yml` 에 추가:

```yaml
  nginx:
    image: nginx:1.25-alpine
    container_name: popspot-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./letsencrypt-backup:/etc/letsencrypt:ro
    depends_on:
      - backend
```

---

## 10. 최종 검증 체크리스트

전환 완료 후 아래 12가지 모두 ✅ 되어야 함.

### 🟢 인프라
- [ ] `docker compose ps` → 3개 컨테이너 (backend, postgres, redis) Up
- [ ] `docker compose logs backend` → "Started Application in N seconds" 확인
- [ ] `curl http://시놀로지내부IP:8080/actuator/health` → `{"status":"UP"}`

### 🟢 도메인 / SSL
- [ ] `https://popspot.duckdns.org` 접속 시 자물쇠 🔒 표시
- [ ] DuckDNS IP 가 친구 집 IP 로 갱신됨
- [ ] 80 포트 접속 시 자동 https 리다이렉트

### 🟢 데이터
- [ ] PostgreSQL `popup_store` 테이블 row 수가 GCP 와 동일
- [ ] 사용자 로그인 가능 (기존 계정)
- [ ] 업로드된 이미지 정상 노출

### 🟢 기능
- [ ] 메인 페이지 팝업 리스트 표시
- [ ] 캘린더에 1~2개월치 팝업 표시
- [ ] 자동수집 트리거 → AUTO_PUBLISHED 정상 (admin 계정)
- [ ] Vercel 프론트 → 시놀로지 백엔드 API 호출 성공 (CORS)

### 🟢 정리
- [ ] GCP VM 정지 (만료일까지 데이터 보존)
- [ ] DuckDNS GCP IP 항목 삭제

---

## 11. 트러블슈팅

### Q1. 컨테이너가 메모리 부족으로 죽음 (OOMKilled)

**증상**: `docker compose logs backend` 에 `Killed` 또는 컨테이너가 계속 재시작.

**원인**: 시놀로지 RAM 1~2 GB 에서 Postgres + Redis + JVM 동시 구동.

**해결**:
```yaml
# docker-compose.yml 의 backend 서비스에 추가
environment:
  JAVA_TOOL_OPTIONS: "-Xms256m -Xmx512m"
```

그래도 안 되면 Redis 제거 (Spring 캐시를 메모리 캐시로 전환).

---

### Q2. 외부에서 도메인 접속 안 됨

**체크 순서**:
1. 친구 집 외부 IP 확인: https://www.whatismyip.com
2. DuckDNS IP 가 그 IP 와 같은지 확인
3. 공유기 포트포워딩 80, 443 정상인지
4. 시놀로지 방화벽 (DSM → 제어판 → 보안 → 방화벽) 80, 443 허용
5. ISP 가 80 포트 차단했는지 (한국 일부 ISP 가정용 차단) → 비표준 포트 사용

---

### Q3. CORS 에러 (Vercel 프론트 → 시놀로지 백엔드)

**증상**: 브라우저 콘솔에 `Access-Control-Allow-Origin` 에러.

**해결**: `application-prod.properties` 또는 Spring 설정에서 Vercel 도메인 추가.

```properties
popspot.cors.allowed-origins=https://popspot.vercel.app,https://popspot.duckdns.org
```

---

### Q4. PostgreSQL 복원 실패 (encoding/locale)

**증상**: `pg_dumpall` 복원 시 `invalid byte sequence for encoding "UTF8"`.

**해결**: 컨테이너 환경변수에 한국어 locale 명시.

```yaml
environment:
  POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C.UTF-8"
  LANG: C.UTF-8
```

---

### Q5. DB 이름이 `popspot` 이 아닌 경우

GCP `psql -l` 결과에서 진짜 DB 이름 확인 (`popup_store_db`, `popspot_prod` 등 가능).
- `pg_dumpall` 은 어차피 모든 DB 를 떠서 무관.
- `application-prod.properties` 의 `spring.datasource.url` 에 적힌 DB 이름 = 새 환경에서도 그대로 써야 함.

---

### Q6. 자동수집 스케줄 (4 AM 크롤, 5 AM 만료)

`@Scheduled` 가 KST 기준이니 컨테이너 TZ 가 `Asia/Seoul` 로 잡혀있어야 합니다.
`docker-compose.yml` 에 `TZ: Asia/Seoul` 이미 추가됨 — 시간대 검증:

```bash
docker exec popspot-backend date
# 출력이 KST (UTC+9) 여야 함
```

---

## 📌 마무리 — 다음 액션 아이템

1. ✅ **친구한테 정보 받기**: 시놀로지 모델/RAM/외부IP/SSH 가능 여부
2. ✅ **GCP 에서 의심사항 2개 확인**:
   - `sudo -u postgres psql -l` (진짜 DB 이름)
   - `sudo cat /etc/nginx/sites-available/default` (nginx 설정)
3. ✅ **방법 A or B 선택**해서 파일 전송
4. ✅ **시놀로지에 docker-compose.yml 작성** + 띄우기
5. ✅ **DuckDNS IP 변경** + 포트포워딩
6. ✅ **최종 검증 체크리스트 12개** 통과
7. ✅ **GCP VM 정지** (5/28 전에)

---

## 🔐 보안 메모

- `popspot.env` 옮길 때 평문 SCP 도 SSH 위에서 암호화되니 안전.
- 시놀로지에 옮긴 후 `chmod 600 popspot.env` 권한 잠그기.
- API 키 (Naver, Kakao, Gemini) 가 `popspot.env` 에 있으면 절대 git 에 커밋 ❌.
- 이전 완료 후 GCP 에 남은 키 정보는 VM 삭제하면 같이 사라짐.

---

> 💬 막히는 부분 생기면 어느 단계에서 무슨 에러 났는지 알려주세요. 구체적인 에러 메시지 + 명령어 같이 주시면 가장 빨리 풀 수 있어요.
