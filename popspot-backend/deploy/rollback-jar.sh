#!/usr/bin/env bash
# =================================================================
# POP-SPOT 백엔드 되돌리기 — 직전 jar 로.
#
#   sudo bash rollback-jar.sh
#
# swap-jar.sh 가 기동·검증에 실패하면 알아서 되돌린다. 이 스크립트는 그 <뒤에> 필요한
# 경우를 위한 것이다 — 기동은 됐는데 기능이 깨진 때. 2026-09-05 에 실제로 그랬다:
# 서비스는 멀쩡히 떴고 API 도 응답했는데 소셜 로그인만 503 이었다.
#
# 자동 검증이 잡을 수 있는 것은 "떴는가" 까지다. "제대로 도는가" 는 사람이 본다.
# =================================================================
set -euo pipefail

APP_USER="reo4321"
APP_HOME="/home/${APP_USER}"
JAR="${APP_HOME}/popspot-backend-0.0.1-SNAPSHOT.jar"
PREV="${APP_HOME}/popspot-backend-prev.jar"
SERVICE="popspot"
HEALTH_URL="http://127.0.0.1:8080/actuator/health/liveness"

die() { echo "❌ $*" >&2; exit 1; }

[[ "$EUID" -eq 0 ]] || die "root 권한이 필요합니다. sudo 로 실행하세요."
[[ -f "$PREV" ]] || die "되돌릴 jar 가 없습니다: $PREV"

CURRENT="$(sha256sum "$JAR" 2>/dev/null | cut -d' ' -f1 || echo '없음')"
TARGET="$(sha256sum "$PREV" | cut -d' ' -f1)"

if [[ "$CURRENT" == "$TARGET" ]]; then
    die "현재 jar 가 이미 그 해시입니다($TARGET). 되돌릴 것이 없습니다."
fi

echo "==> 되돌립니다"
echo "    현재: $CURRENT"
echo "    대상: $TARGET"

# 되돌린 뒤에도 한 번 더 되돌릴 수 있어야 한다. 지금 것을 실패본으로 남긴다.
cp -f "$JAR" "${APP_HOME}/popspot-backend-failed.jar"

systemctl stop "$SERVICE"
cp -f "$PREV" "$JAR"
chown "${APP_USER}:${APP_USER}" "$JAR"
systemctl start "$SERVICE"

echo "==> 기동 대기"
deadline=$(( SECONDS + 90 ))
until curl -fsS -m 3 "$HEALTH_URL" >/dev/null 2>&1; do
    (( SECONDS < deadline )) || die "되돌린 jar 도 기동하지 않습니다. ~/nohup.out 을 보세요."
    sleep 2
done

echo
echo "✅ 되돌렸습니다"
echo "   실행 중  : $TARGET"
echo "   실패본   : ${APP_HOME}/popspot-backend-failed.jar"
echo "   원인 확인: grep -a ERROR ${APP_HOME}/nohup.out | tail -20"
