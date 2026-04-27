#!/usr/bin/env bash
# =================================================================
# POP-SPOT 백엔드 — VM 첫 셋업 스크립트
# (한 번만 실행. 이후 재배포는 redeploy.sh 사용)
#
# 사용 흐름 (사용자 환경):
#   [Windows 로컬] ./gradlew build -x test
#   [Windows 로컬] scp -i ~/.ssh/gcp_key build/libs/popspot-backend-0.0.1-SNAPSHOT.jar \
#                     reo4321@34.121.111.208:~/
#   [VM] ssh reo4321@34.121.111.208
#   [VM] sudo bash deploy.sh    ← 처음 한 번만
# =================================================================
set -euo pipefail

APP_USER="reo4321"
APP_HOME="/home/${APP_USER}"
JAR_NAME="popspot-backend-0.0.1-SNAPSHOT.jar"
LOG_DIR="/var/log/popspot"

if [[ "$EUID" -ne 0 ]]; then
    echo "❌ root 권한이 필요합니다. sudo 로 실행하세요."; exit 1
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
    echo "❌ 사용자 ${APP_USER} 가 없습니다. SSH 로 접속하던 그 사용자가 맞는지 확인하세요."; exit 1
fi

if [[ ! -f "${APP_HOME}/${JAR_NAME}" ]]; then
    echo "❌ ${APP_HOME}/${JAR_NAME} 가 없습니다."
    echo "   먼저 로컬에서 scp 로 jar 를 ~/ 에 올려두세요:"
    echo "   scp -i ~/.ssh/gcp_key build/libs/${JAR_NAME} ${APP_USER}@<VM-IP>:~/"
    exit 1
fi

echo "==> 1. 로그 디렉토리 / uploads 준비"
mkdir -p "${LOG_DIR}" "${APP_HOME}/uploads"
chown "${APP_USER}:${APP_USER}" "${LOG_DIR}" "${APP_HOME}/uploads"
chmod 755 "${LOG_DIR}" "${APP_HOME}/uploads"

echo "==> 2. 환경변수 파일 점검"
if [[ ! -f "${APP_HOME}/popspot.env" ]]; then
    SRC_ENV="$(dirname "${BASH_SOURCE[0]}")/../.env.example"
    if [[ -f "$SRC_ENV" ]]; then
        cp "$SRC_ENV" "${APP_HOME}/popspot.env"
    else
        echo "# 채워주세요" > "${APP_HOME}/popspot.env"
    fi
    chown "${APP_USER}:${APP_USER}" "${APP_HOME}/popspot.env"
    chmod 600 "${APP_HOME}/popspot.env"
    echo ""
    echo "⚠️  ${APP_HOME}/popspot.env 가 만들어졌습니다."
    echo "    실제 시크릿(JWT_SECRET / DB_PASSWORD / 각종 API 키) 채워주세요:"
    echo "       nano ${APP_HOME}/popspot.env"
    echo ""
fi

echo "==> 3. systemd 유닛 설치"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "${SCRIPT_DIR}/popspot.service" /etc/systemd/system/popspot.service
systemctl daemon-reload
systemctl enable popspot

echo "==> 4. jar 권한"
chown "${APP_USER}:${APP_USER}" "${APP_HOME}/${JAR_NAME}"

echo ""
echo "✅ 첫 셋업 완료."
echo "   1) 환경변수 채웠는지 확인:  cat ${APP_HOME}/popspot.env"
echo "   2) 서비스 시작:             sudo systemctl start popspot"
echo "   3) 로그 확인:               sudo journalctl -u popspot -f"
echo "   4) 헬스체크:                curl -s http://127.0.0.1:8080/actuator/health"
echo ""
echo "📦 다음번 재배포는 deploy/redeploy.sh 한 줄로:"
echo "   sudo bash redeploy.sh"
