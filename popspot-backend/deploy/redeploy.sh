#!/usr/bin/env bash
# =================================================================
# POP-SPOT 재배포 (매번 사용)
#
# 흐름:
#   [Windows 로컬]
#     ./gradlew build -x test
#     scp -i ~/.ssh/gcp_key build/libs/popspot-backend-0.0.1-SNAPSHOT.jar \
#         reo4321@34.121.111.208:~/
#
#   [VM]
#     ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208
#     sudo bash redeploy.sh
# =================================================================
set -euo pipefail

APP_USER="reo4321"
APP_HOME="/home/${APP_USER}"
JAR_NAME="popspot-backend-0.0.1-SNAPSHOT.jar"

if [[ "$EUID" -ne 0 ]]; then
    echo "❌ root 권한이 필요합니다. sudo 로 실행하세요."; exit 1
fi

if [[ ! -f "${APP_HOME}/${JAR_NAME}" ]]; then
    echo "❌ ${APP_HOME}/${JAR_NAME} 가 없습니다. 먼저 scp 로 올리세요."; exit 1
fi

echo "==> jar 권한 정리"
chown "${APP_USER}:${APP_USER}" "${APP_HOME}/${JAR_NAME}"

echo "==> 서비스 재시작"
systemctl restart popspot
sleep 3

echo ""
echo "==> 상태:"
systemctl status popspot --no-pager -l | sed -n '1,15p'

echo ""
echo "==> 헬스체크:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8080/actuator/health || true

echo ""
echo "✅ 완료. 실시간 로그: sudo journalctl -u popspot -f"
