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
# 두 사양을 번갈아 시도한다. 둘 다 무료 한도 안이고, 2코어 자리는 없어도
# 1코어 틈은 자주 난다. 유료 전환이 선택지에 없으므로 먼저 오는 것을 잡는다.
BIG_OCPUS=2;   BIG_MEM=8
SMALL_OCPUS=1; SMALL_MEM=6
BOOT_GB=50
INTERVAL_S=300         # 자리가 없을 때 대기. 60초로 하면 429(요청 과다)에 걸린다
BACKOFF_S=900          # 429 를 맞았을 때 대기
MAX_TRIES=200          # 5분 간격이므로 약 16시간
# ────────────────────────────────────────────────────────────

die() { echo "❌ $*" >&2; exit 1; }

# Cloud Shell 에는 oci 가 PATH 에 있다. 내 PC 에서는 venv 안에 있어서
# 매번 export 를 치게 하면 붙여넣기에서 깨진다. 여기서 직접 찾는다.
if ! command -v oci >/dev/null 2>&1; then
  for d in "$HOME/oci-venv/Scripts" "$HOME/oci-venv/bin" "$HOME/lib/oracle-cli/bin"; do
    if [ -x "$d/oci.exe" ] || [ -x "$d/oci" ]; then
      PATH="$d:$PATH"
      export PATH
      break
    fi
  done
fi
command -v oci >/dev/null 2>&1 || die "oci 명령을 못 찾았습니다.
   찾아본 곳: ~/oci-venv/Scripts, ~/oci-venv/bin, ~/lib/oracle-cli/bin"

# 공개키 위치는 환경에 따라 다르다. Cloud Shell 은 홈에 올려두고,
# 내 PC 는 ssh-keygen 이 만든 자리에 그대로 있다.
for f in "$PUBKEY_FILE" ~/.ssh/oracle_popspot.pub; do
  [ -f "$f" ] && { PUBKEY_FILE=$f; break; }
done

[ -f "$PUBKEY_FILE" ] || die "공개키 파일을 못 찾았습니다.
   찾아본 곳: ~/popspot.pub, ~/.ssh/oracle_popspot.pub"

# 여러 줄로 붙여넣어졌어도 ssh- 로 시작하는 첫 줄만 쓴다.
PUBKEY=$(grep -m1 '^ssh-' "$PUBKEY_FILE" | tr -d '\r')
[ -n "$PUBKEY" ] || die "$PUBKEY_FILE 안에 ssh- 로 시작하는 줄이 없습니다.
   .pub 파일(공개키)이 맞는지 확인하세요. 개인키 파일은 -----BEGIN 으로 시작합니다."

# Cloud Shell 은 OCI_TENANCY 를 넣어준다. 내 PC 에서는 설정 파일에서 꺼낸다.
COMPARTMENT="${OCI_TENANCY:-}"
if [ -z "$COMPARTMENT" ] && [ -f ~/.oci/config ]; then
  # 윈도우가 쓴 설정 파일은 줄 끝에 CR 이 붙는다. 앞뒤 공백과 함께 털어낸다.
  COMPARTMENT=$(sed -n 's/^[[:space:]]*tenancy[[:space:]]*=[[:space:]]*//p' ~/.oci/config |
    head -1 | tr -d '\r' | tr -d '[:space:]')
fi
[ -n "$COMPARTMENT" ] || die "테넌시 OCID 를 못 찾았습니다.
   Cloud Shell 이 아니라면 먼저 'oci setup config' 를 끝내야 합니다."

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

echo "${BIG_OCPUS}코어/${BIG_MEM}GB 와 ${SMALL_OCPUS}코어/${SMALL_MEM}GB 를 번갈아 시도합니다."
echo "먼저 자리가 나는 쪽을 잡습니다. ${INTERVAL_S}초 간격."
echo

for i in $(seq 1 "$MAX_TRIES"); do
  if [ $((i % 2)) -eq 1 ]; then
    OCPUS=$BIG_OCPUS;   MEM_GB=$BIG_MEM
  else
    OCPUS=$SMALL_OCPUS; MEM_GB=$SMALL_MEM
  fi

  printf '[%3d] %s  %d코어/%dGB ... ' "$i" "$(date '+%H:%M:%S')" "$OCPUS" "$MEM_GB"

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
