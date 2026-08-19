#!/usr/bin/env bash
#
# 도쿄에 A1 자리가 날 때까지 인스턴스 생성을 재시도한다.
# OCI Cloud Shell 에서 돌린다 — 거기엔 oci CLI 가 이미 인증된 채로 깔려 있다.
#
#   1. 콘솔 오른쪽 위 [>_] 아이콘 → Cloud Shell
#   2. cat > ~/popspot.pub   ← 공개키 붙여넣고 Ctrl+D
#   3. cat > retry.sh        ← 이 스크립트 붙여넣고 Ctrl+D
#   4. bash retry.sh
#
# 자리가 없으면 60초 뒤 다시 시도하고, 그 외 오류가 나면 멈춘다.
# 설정이 틀렸는데 밤새 도는 것이 제일 나쁘기 때문이다.

set -uo pipefail

# ── 여기만 바꾼다 ────────────────────────────────────────────
# 공개키는 이 파일에서 읽는다. 스크립트를 편집할 필요가 없다.
#   cat > ~/popspot.pub     ← 붙여넣고 Ctrl+D
PUBKEY_FILE=~/popspot.pub
NAME="popspot-api"
OCPUS=2                # 이틀을 기다려도 안 나면 1 로 낮춘다
MEM_GB=8               # OCPUS 를 1 로 낮출 때는 6 으로 (코어당 6GB 가 A1 기본)
BOOT_GB=50
INTERVAL_S=300         # 자리가 없을 때 대기. 60초로 하면 429(요청 과다)에 걸린다
BACKOFF_S=900          # 429 를 맞았을 때 대기
MAX_TRIES=200          # 5분 간격이므로 약 16시간
# ────────────────────────────────────────────────────────────

die() { echo "❌ $*" >&2; exit 1; }

[ -f "$PUBKEY_FILE" ] || die "$PUBKEY_FILE 이 없습니다.
   PC의 PowerShell 에서:  Get-Content \"\$HOME\\.ssh\\oracle_popspot.pub\" | Set-Clipboard
   Cloud Shell 에서:      cat > $PUBKEY_FILE   ← 붙여넣고 Ctrl+D"

# 여러 줄로 붙여넣어졌어도 ssh- 로 시작하는 첫 줄만 쓴다.
PUBKEY=$(grep -m1 '^ssh-' "$PUBKEY_FILE" | tr -d '\r')
[ -n "$PUBKEY" ] || die "$PUBKEY_FILE 안에 ssh- 로 시작하는 줄이 없습니다.
   .pub 파일(공개키)이 맞는지 확인하세요. 개인키 파일은 -----BEGIN 으로 시작합니다."

COMPARTMENT="${OCI_TENANCY:-}"
[ -n "$COMPARTMENT" ] || die "OCI_TENANCY 가 비어 있습니다. Cloud Shell 에서 돌리고 있는지 확인하세요."

echo "가용성 도메인·서브넷·이미지를 찾는 중..."

AD=$(oci iam availability-domain list --query 'data[0].name' --raw-output) \
  || die "가용성 도메인 조회 실패"

# 퍼블릭 서브넷 = 공인 IP 를 금지하지 않는 서브넷. 이름이 한국어라 이름으로 찾지 않는다.
SUBNET=$(oci network subnet list -c "$COMPARTMENT" --all \
  --query 'data[?"prohibit-public-ip-on-vnic"==`false`].id | [0]' --raw-output) \
  || die "서브넷 조회 실패"
[ "$SUBNET" != "null" ] || die "퍼블릭 서브넷이 없습니다. popspot-vcn 이 만들어졌는지 확인하세요."

IMAGE=$(oci compute image list -c "$COMPARTMENT" \
  --operating-system "Canonical Ubuntu" \
  --operating-system-version "22.04" \
  --shape "VM.Standard.A1.Flex" \
  --sort-by TIMECREATED --sort-order DESC \
  --query 'data[0].id' --raw-output) \
  || die "이미지 조회 실패"
[ "$IMAGE" != "null" ] || die "Ubuntu 22.04 ARM 이미지를 못 찾았습니다."

echo "  AD      $AD"
echo "  서브넷  ${SUBNET: -12}"
echo "  이미지  ${IMAGE: -12}"
echo

ERR=$(mktemp)
trap 'rm -f "$ERR"' EXIT

try() {
  local ocpus=$1 mem=$2
  oci compute instance launch \
    -c "$COMPARTMENT" \
    --availability-domain "$AD" \
    --display-name "$NAME" \
    --shape "VM.Standard.A1.Flex" \
    --shape-config "{\"ocpus\":$ocpus,\"memoryInGBs\":$mem}" \
    --image-id "$IMAGE" \
    --subnet-id "$SUBNET" \
    --assign-public-ip true \
    --boot-volume-size-in-gbs "$BOOT_GB" \
    --metadata "{\"ssh_authorized_keys\":\"$PUBKEY\"}" \
    --wait-for-state RUNNING \
    >/dev/null 2>"$ERR"
}

echo "${OCPUS}코어 / ${MEM_GB}GB 자리가 날 때까지 기다립니다. 60초 간격."
echo "작은 사양으로 타협하지 않습니다 — 낮추려면 위쪽 OCPUS·MEM_GB 를 고치고 다시 돌리세요."
echo

for i in $(seq 1 "$MAX_TRIES"); do
  printf '[%3d] %s ... ' "$i" "$(date '+%H:%M:%S')"

  if try "$OCPUS" "$MEM_GB"; then
    echo "성공"
    echo
    echo "✅ $NAME 이 떴습니다 (${OCPUS}코어 / ${MEM_GB}GB)"
    oci compute instance list -c "$COMPARTMENT" \
      --display-name "$NAME" --lifecycle-state RUNNING \
      --query 'data[0].id' --raw-output |
      xargs -I{} oci compute instance list-vnics --instance-id {} \
        --query 'data[0]."public-ip"' --raw-output |
      xargs -I{} echo "   공인 IP: {}   →   ssh -i ~/.ssh/oracle_popspot ubuntu@{}"
    exit 0
  fi

  # 429 는 설정 오류가 아니라 "천천히 하라" 는 뜻이다. 더 오래 쉬고 계속한다.
  if grep -qi "TooManyRequests" "$ERR"; then
    echo "요청 과다 — ${BACKOFF_S}초 쉼"
    sleep "$BACKOFF_S"
    continue
  fi

  if grep -qi "capacity" "$ERR"; then
    echo "자리 없음"
    sleep "$INTERVAL_S"
    continue
  fi

  # 자리도 아니고 속도도 아니면 설정 문제다. 멈추고 보여준다.
  echo "중단"
  echo
  echo "──── 용량 부족이 아닌 오류라 멈춥니다 ────" >&2
  cat "$ERR" >&2
  exit 1
done

echo
echo "⏱  ${MAX_TRIES}회 시도했지만 자리가 나지 않았습니다."
echo "   계획서의 48시간 규칙에 따라, 여기서 멈추고 유료 전환 여부를 상의하세요."
exit 2
