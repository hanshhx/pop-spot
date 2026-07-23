# POP-SPOT 백엔드 GCP Compute Engine VM 배포 가이드

## 사용자 환경 (확정)

```
[Windows 로컬]
  - ./gradlew build -x test
  - scp -i ~/.ssh/gcp_key "...\build\libs\popspot-backend-0.0.1-SNAPSHOT.jar" reo4321@34.121.111.208:~/

[GCP VM]   IP: 34.121.111.208
  - SSH 사용자: reo4321
  - jar 위치: /home/reo4321/popspot-backend-0.0.1-SNAPSHOT.jar
  - env 파일: /home/reo4321/popspot.env
  - systemd 유닛: /etc/systemd/system/popspot.service
  - 로그: /var/log/popspot/app.log
  - uploads: /home/reo4321/uploads/
```

---

## 1. VM 최초 셋업 (한 번만)

```bash
ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208

# 패키지
sudo apt update && sudo apt upgrade -y
sudo apt install -y openjdk-21-jre-headless nginx redis-server git ufw certbot python3-certbot-nginx

# 방화벽
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 2. PostgreSQL 셋업 (한 번만)

레포를 VM 으로 클론해서 스크립트를 쓰는 방법, 또는 그냥 명령으로 처리 둘 다 가능.

### 방법 A — 스크립트 사용
```bash
# 로컬에서 deploy 폴더만 scp 로 올리기 (선택사항)
scp -i ~/.ssh/gcp_key -r deploy reo4321@34.121.111.208:~/

# VM
cd ~/deploy
sudo DB_PASSWORD="$(openssl rand -base64 24)" bash postgresql-setup.sh
# 출력된 비번 메모 → 5단계 popspot.env 의 DB_PASSWORD 와 동일하게!
```

### 방법 B — 직접 명령
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

DB_PW=$(openssl rand -base64 24); echo "DB_PASSWORD=$DB_PW"
sudo -u postgres psql <<SQL
CREATE ROLE popspot_user LOGIN PASSWORD '${DB_PW}';
CREATE DATABASE popspot_db OWNER popspot_user;
GRANT ALL PRIVILEGES ON DATABASE popspot_db TO popspot_user;
SQL
```

---

## 3. nginx + Let's Encrypt (한 번만)

```bash
# deploy 폴더 scp 로 이미 올렸다고 가정
sudo cp ~/deploy/nginx-popspot.conf /etc/nginx/sites-available/popspot
sudo ln -sf /etc/nginx/sites-available/popspot /etc/nginx/sites-enabled/popspot
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Let's Encrypt
sudo certbot --nginx -d api.popspot.co.kr --redirect --non-interactive --agree-tos -m you@example.com
```

---

## 4. 첫 jar 업로드 + systemd 등록 (한 번만)

### Windows 로컬
```powershell
cd C:\Users\kim donghyun\Documents\popspot_project\popspot-backend
./gradlew build -x test

scp -i ~/.ssh/gcp_key "build/libs/popspot-backend-0.0.1-SNAPSHOT.jar" reo4321@34.121.111.208:~/
scp -i ~/.ssh/gcp_key -r deploy reo4321@34.121.111.208:~/
```

### VM
```bash
ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208

sudo bash ~/deploy/deploy.sh
# ↑ /home/reo4321/popspot.env 가 .env.example 에서 복사됨
# ↑ systemd 유닛 등록됨 (아직 start 는 안 함)
```

---

## 5. 환경변수 채우기 (가장 중요)

```bash
sudo nano /home/reo4321/popspot.env
```

**필수 채워야 하는 값:**

| 변수 | 의미 | 생성/조회 방법 |
|---|---|---|
| `JWT_SECRET` | JWT 서명키 (32B+) | `openssl rand -base64 48` |
| `DB_PASSWORD` | Postgres 비번 | 2단계의 `DB_PW` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Gmail SMTP | https://myaccount.google.com/apppasswords |
| `GOOGLE_CLIENT_ID` / `_SECRET` | OAuth | Google Cloud Console |
| `KAKAO_CLIENT_ID`, `KAKAO_REST_API_KEY` | OAuth + 지도 | developers.kakao.com |
| `NAVER_CLIENT_ID` / `_SECRET` | OAuth | developers.naver.com |
| `IAMPORT_API_KEY` / `_SECRET` | 결제 검증 | 포트원 콘솔 > 일반결제(REST API) |
| `GEMINI_API_KEY` | AI | aistudio.google.com |
| `APP_FRONTEND_URL` | Vercel 메인 도메인 | 예: `https://popspot.co.kr` |
| `APP_ALLOWED_ORIGINS` | 쉼표로 여러 개 (Vercel preview 포함) | 예: `https://popspot.co.kr,https://popspot-preview.vercel.app` |
| `APP_OAUTH2_REDIRECT_URI` | OAuth 콜백 | 예: `https://popspot.co.kr/oauth/callback` |
| `SENTRY_DSN` (선택) | 에러 추적 | sentry.io |

> ⚠️ **이 파일이 유출되면 모든 키가 털립니다.** 권한은 `600`.

---

## 6. 첫 부팅 (Flyway + validate)

운영에서는 첫 부팅을 포함해 `dev` 또는 `ddl-auto=update`를 사용하지 않는다. 기존 DB는 백업 후
Flyway가 마이그레이션을 적용하게 하고, 신규 빈 DB는 검증된 schema-only 백업을 먼저 복원한다.

기존 운영 DB는 V22까지 수동 SQL이 적용된 상태이다. `flyway_schema_history`가 없는 첫 prod 기동은
`application-prod.properties`의 `baseline-version=22`로 기존 상태를 기준점으로 기록한 뒤 V23만 실행한다.
기준 버전을 V1로 두면 과거의 비멱등 마이그레이션이 다시 실행될 수 있으므로 변경하지 않는다.

```bash
# popspot.env
SPRING_PROFILES_ACTIVE=prod
JPA_DDL_AUTO=validate

sudo systemctl start popspot
sudo journalctl -u popspot -f
```

스키마 확인:
```bash
psql -h 127.0.0.1 -U popspot_user -d popspot_db -c "\dt"
```

---

## 7. 운영 모드로 영구 전환

```bash
sudo nano /home/reo4321/popspot.env
# SPRING_PROFILES_ACTIVE=prod
# JPA_DDL_AUTO=validate

sudo systemctl restart popspot
```

이후 스키마 변경은 **반드시** Flyway 마이그레이션 파일 (`src/main/resources/db/migration/V?__*.sql`) 로.

---

## 8. 매번 재배포 (이게 메인)

### Windows 로컬
```powershell
cd C:\Users\kim donghyun\Documents\popspot_project\popspot-backend
./gradlew build -x test

scp -i ~/.ssh/gcp_key "build/libs/popspot-backend-0.0.1-SNAPSHOT.jar" reo4321@34.121.111.208:~/
```

### VM
```bash
ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208
sudo bash ~/deploy/redeploy.sh
```

`redeploy.sh` 가 자동으로:
1. jar 권한 정리
2. `systemctl restart popspot`
3. 3초 대기 후 status / health 확인

---

## 9. 한 번에 끝내고 싶으면 (로컬 → VM 한 줄)

PowerShell:
```powershell
./gradlew build -x test; `
scp -i ~/.ssh/gcp_key "build/libs/popspot-backend-0.0.1-SNAPSHOT.jar" reo4321@34.121.111.208:~/; `
ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208 "sudo bash ~/deploy/redeploy.sh"
```

bash (WSL/macOS):
```bash
./gradlew build -x test \
&& scp -i ~/.ssh/gcp_key build/libs/popspot-backend-0.0.1-SNAPSHOT.jar reo4321@34.121.111.208:~/ \
&& ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208 'sudo bash ~/deploy/redeploy.sh'
```

---

## 10. CORS 검증 (배포 후 즉시)

```bash
curl -i -X OPTIONS https://api.popspot.co.kr/api/v1/auth/login \
  -H "Origin: https://popspot.co.kr" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"
```

기대 응답:
```
HTTP/2 200
Access-Control-Allow-Origin: https://popspot.co.kr   ← "*" 가 아니어야 함
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, ...
```

자세한 진단표는 `DEPLOY_CHECKLIST.md` 참조.

---

## 11. 자주 마주치는 부팅 실패

| 에러 | 원인 | 해결 |
|---|---|---|
| `JWT_SECRET 환경변수가 설정되지 않았습니다` | env 누락 | popspot.env 에 `openssl rand -base64 48` |
| `validate ... missing column/sequence` | 스키마 없음 | 6단계 update 한 번 → validate 복귀 |
| `password authentication failed for user "popspot_user"` | DB 비번 불일치 | 2단계 비번과 popspot.env 동일하게 |
| `Address already in use: bind` | 8080 누가 잡음 | `sudo lsof -i :8080` |
| 502 Bad Gateway | systemd 가 죽음 | `sudo journalctl -u popspot -n 200` |
| 프론트 CORS 에러 | `APP_ALLOWED_ORIGINS` 누락 | env 수정 → restart |
| WebSocket 핸드셰이크 403 | 같은 이유 | env 수정 → restart |
| Mixed Content | 프론트가 http://...8080 직접 호출 | `NEXT_PUBLIC_API_URL=https://api.popspot.co.kr` Vercel 등록 + Redeploy |
