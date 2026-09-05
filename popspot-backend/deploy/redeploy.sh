#!/usr/bin/env bash
# =================================================================
# ⚠️ 이 스크립트는 낡았습니다. swap-jar.sh 를 쓰세요.
#
# 여기 적힌 절차가 실제와 다릅니다:
#   - "로컬에서 ./gradlew build" — 개발 PC 에서 gradle 이 안 돕니다(로컬 소켓 차단).
#     jar 는 CI 산출물을 받습니다: gh run download <runId> -n popspot-backend-jar
#   - IP 34.121.111.208 — 틀린 주소입니다. 서버는 VM-113 입니다.
#   - 전송된 바이트를 확인하지 않고, 이전 jar 를 남기지 않고, 되돌릴 방법이 없습니다.
#
# 2026-09-05 에 손으로 배포하다 소셜 로그인이 죽어 되돌렸습니다. 그때 필요했던 것이
# 전부 여기 없던 것들입니다. swap-jar.sh 가 그 절차를 담고 있습니다.
#
# 지우지 않고 남기는 이유: nginx·postgresql 설정 등 다른 파일이 이 이름을 참조하고,
# 무엇이 왜 바뀌었는지가 이 자리에 있어야 다음 사람이 옛 문서를 다시 믿지 않습니다.
# =================================================================
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
