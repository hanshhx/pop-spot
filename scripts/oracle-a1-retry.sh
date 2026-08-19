#!/usr/bin/env bash
#
# 도쿄에 A1 자리가 날 때까지 인스턴스 생성을 재시도한다.
# OCI Cloud Shell 에서 돌린다 — 거기엔 oci CLI 가 이미 인증된 채로 깔려 있다.
#
#   1. 콘솔 오른쪽 위 [>_] 아이콘 → Cloud Shell
#   2. 아래 PUBKEY 를 자기 공개키로 바꾼다
#   3. bash oracle-a1-retry.sh
#
# 자리가 없으면 60초 뒤 다시 시도하고, 그 외 오류가 나면 멈춘다.
# 설정이 틀렸는데 밤새 도는 것이 제일 나쁘기 때문이다.

set -uo pipefail

# ── 여기만 바꾼다 ────────────────────────────────────────────
PUBKEY="ssh-ed25519 AAAA... popspot-oracle"
NAME="popspot-api"
BOOT_GB=50
MAX_TRIES=600          # 60초 간격이므로 약 10시간
# ────────────────────────────────────────────────────────────

die() { echo "❌ $*" >&2; exit 1; }

case "$PUBKEY" in
  *AAAA...*) die "PUBKEY 를 실제 공개키로 바꾸세요. oracle_popspot.pub 내용 한 줄입니다." ;;
  ssh-*) ;;
  *) die "PUBKEY 가 ssh- 로 시작하지 않습니다. .pub 파일 내용이 맞는지 보세요." ;;
esac

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

# 큰 것과 작은 것을 번갈아 시도한다. 2코어 자리는 없어도 1코어 자리는 있을 수 있다.
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

for i in $(seq 1 "$MAX_TRIES"); do
  if [ $((i % 2)) -eq 1 ]; then OCPUS=2; MEM=8; else OCPUS=1; MEM=6; fi

  printf '[%3d] %s  %d코어/%dGB ... ' "$i" "$(date '+%H:%M:%S')" "$OCPUS" "$MEM"

  if try "$OCPUS" "$MEM"; then
    echo "성공"
    echo
    echo "✅ $NAME 이 떴습니다 ($OCPUS코어 / ${MEM}GB)"
    oci compute instance list -c "$COMPARTMENT" \
      --display-name "$NAME" --lifecycle-state RUNNING \
      --query 'data[0].id' --raw-output |
      xargs -I{} oci compute instance list-vnics --instance-id {} \
        --query 'data[0]."public-ip"' --raw-output |
      xargs -I{} echo "   공인 IP: {}   →   ssh -i ~/.ssh/oracle_popspot ubuntu@{}"
    exit 0
  fi

  if grep -qi "capacity" "$ERR"; then
    echo "자리 없음"
    sleep 60
    continue
  fi

  # 자리 문제가 아니면 설정 문제다. 멈추고 보여준다.
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
