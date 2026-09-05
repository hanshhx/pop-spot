#!/usr/bin/env bash
# =================================================================
# POP-SPOT 백엔드 jar 교체 — 검증과 자동 롤백까지.
#
# 쓰는 법 (VM 에서):
#   sudo bash swap-jar.sh ~/popspot-backend-new.jar <기대_sha256>
#
# 기대 해시는 jar 를 만든 쪽에서 알려 준다. jar 는 CI 산출물을 받는다:
#   gh run download <runId> -n popspot-backend-jar -D <경로>
#
# 왜 이 스크립트인가 — 2026-09-05 에 손으로 배포하다 로그인이 죽어 롤백했다. 그때 한 일이
# 전부 사람 손이었다: 해시 눈으로 대조, 이전 jar 를 cp 로 보관, 실패를 보고 mv 로 되돌리기.
# 한 단계라도 빠지면 되돌릴 것이 없어진다. 그 절차를 그대로 옮겨 적었다.
#
# 옛 redeploy.sh 와 다른 점:
#   - 로컬 gradle 빌드를 전제하지 않는다(이 PC 에서 gradle 이 안 돈다). CI 산출물을 받는다.
#   - 전송된 바이트가 맞는지 <먼저> 본다. 틀리면 현재 jar 를 건드리지 않고 멈춘다.
#   - 이전 jar 를 반드시 남긴다.
#   - 기동 후 <실행 중인 프로세스가 연 jar> 의 해시를 확인한다. 디스크의 해시는 전송만 증명한다.
#   - 확인에 실패하면 사람을 기다리지 않고 되돌린다.
# =================================================================
set -euo pipefail

APP_USER="reo4321"
APP_HOME="/home/${APP_USER}"
JAR="${APP_HOME}/popspot-backend-0.0.1-SNAPSHOT.jar"
PREV="${APP_HOME}/popspot-backend-prev.jar"
SERVICE="popspot"

# 기동을 기다리는 시간. 실측 기동이 8~9초라 넉넉히 잡는다.
HEALTH_TIMEOUT=90
# 무거운 /actuator/health 대신 liveness 를 쓴다 — 전자는 메일 지표 때문에 1.5초가 넘는다.
HEALTH_URL="http://127.0.0.1:8080/actuator/health/liveness"

die() { echo "❌ $*" >&2; exit 1; }
note() { echo "==> $*"; }

[[ "$EUID" -eq 0 ]] || die "root 권한이 필요합니다. sudo 로 실행하세요."
[[ $# -eq 2 ]] || die "사용법: sudo bash swap-jar.sh <새_jar_경로> <기대_sha256>"

NEW_JAR="$1"
EXPECTED="$2"

[[ -f "$NEW_JAR" ]] || die "새 jar 가 없습니다: $NEW_JAR"
[[ -f "$JAR" ]] || die "현재 jar 가 없습니다: $JAR (첫 배포라면 손으로 두고 시작하세요)"

# ---------------------------------------------------------------- 1. 바이트 확인
note "전송된 jar 해시 확인"
ACTUAL="$(sha256sum "$NEW_JAR" | cut -d' ' -f1)"
if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "   기대: $EXPECTED" >&2
    echo "   실제: $ACTUAL" >&2
    die "해시가 다릅니다. 현재 jar 를 건드리지 않고 멈춥니다 — 다시 전송하세요."
fi
echo "   OK  $ACTUAL"

# ---------------------------------------------------------------- 2. 되돌릴 것 확보
note "현재 jar 를 보관 ($PREV)"
cp -f "$JAR" "$PREV"
PREV_HASH="$(sha256sum "$PREV" | cut -d' ' -f1)"
echo "   이전: $PREV_HASH"

restore() {
    echo "==> 되돌립니다" >&2
    systemctl stop "$SERVICE" || true
    cp -f "$PREV" "$JAR"
    chown "${APP_USER}:${APP_USER}" "$JAR"
    systemctl start "$SERVICE" || true
    echo "   이전 jar 로 복구했습니다: $PREV_HASH" >&2
}

# ---------------------------------------------------------------- 3. 교체
# 돌아가는 중에 덮어쓰면 안 된다. 자바는 클래스를 지연 로딩하므로 아직 안 꺼낸 클래스가 사라져
# ClassNotFoundException 이 터진다(2026-08-02 실제 발생). 반드시 stop → 교체 → start.
note "서비스 정지"
systemctl stop "$SERVICE"

note "jar 교체"
cp -f "$NEW_JAR" "$JAR"
chown "${APP_USER}:${APP_USER}" "$JAR"

note "서비스 기동"
systemctl start "$SERVICE"

# ---------------------------------------------------------------- 4. 살아났는지
note "기동 대기 (최대 ${HEALTH_TIMEOUT}초)"
deadline=$(( SECONDS + HEALTH_TIMEOUT ))
until curl -fsS -m 3 "$HEALTH_URL" >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
        echo "   ${HEALTH_TIMEOUT}초 안에 응답이 없습니다." >&2
        grep -aE "ERROR|APPLICATION FAILED" "${APP_HOME}/nohup.out" | tail -5 >&2 || true
        restore
        die "기동 실패로 되돌렸습니다."
    fi
    sleep 2
done
echo "   OK  ${SECONDS}초"

# ---------------------------------------------------------------- 5. 도는 것이 그것인지
# 디스크 해시는 <전송>만 증명한다. JVM 은 기동 때 jar 를 열고 그 핸들을 끝까지 붙들므로,
# /proc/<PID>/fd 로 읽어야 지금 실행 중인 바이트가 나온다. 돌던 중에 덮어썼으면 여기서 갈린다.
note "실행 중인 jar 확인"
PID="$(systemctl show "$SERVICE" -p MainPID --value)"
[[ -n "$PID" && "$PID" != "0" ]] || { restore; die "MainPID 를 못 읽었습니다."; }

RUNNING=""
for fd in /proc/"$PID"/fd/*; do
    target="$(readlink "$fd" 2>/dev/null || true)"
    case "$target" in
        *.jar*) RUNNING="$(sha256sum "$fd" | cut -d' ' -f1)"; break ;;
    esac
done

if [[ "$RUNNING" != "$EXPECTED" ]]; then
    echo "   실행 중: ${RUNNING:-못 읽음}" >&2
    restore
    die "실행 중인 jar 가 기대한 것과 다릅니다."
fi

echo "   OK  PID $PID · $RUNNING"
echo
echo "✅ 배포 완료"
echo "   실행 중 : $EXPECTED"
echo "   되돌리기: sudo bash $(dirname "$0")/rollback-jar.sh"
