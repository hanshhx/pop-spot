# Oracle Cloud 서버 만들기

[이전 계획](plan-2026-08-oracle-migration.md)의 **1단계**. 콘솔 작업이라 사람이 해야 한다.

## 시작 전에 — 되돌릴 수 없는 것 하나

**홈 리전은 가입할 때 정해지고 나중에 바꾸기 어렵다.** 나머지는 다 고칠 수 있다.

| | |
|---|---|
| 골라야 할 것 | **Japan East (Tokyo)** — `ap-tokyo-1` |

### 왜 서울이 아닌가

**서울·춘천이 목록에 없다.** 2026-08-19 에 신규 무료 계정으로 확인했더니 ASIA-PACIFIC 구간이
Singapore West 에서 끝났다. Oracle 이 신규 무료 계정에 모든 리전을 열어 주지 않는다.

그래서 그다음으로 가까운 도쿄를 쓴다.

| 리전 | 한국에서 지연(대략) |
|---|---|
| ~~Seoul~~ | ~5ms — 고를 수 없음 |
| **Tokyo** | **~35ms** |
| Singapore | ~70ms |
| 미국 서부 | ~130ms |

35ms 는 API 호출마다 더해지는 값이라 체감이 거의 없다. Vercel 도 도쿄 엣지(`hnd1`)가 있어
프론트와 백엔드가 멀리 갈라지지 않는다.

**가입 나라(Country/Territory)를 대한민국으로 두고도 서울이 안 보이면** 그건 정책이므로 도쿄로 간다.

## 1. 가입

1. <https://www.oracle.com/cloud/free/> → **Start for free**
2. 나라: 대한민국
3. **Home Region: Japan East (Tokyo)** ← 여기서 멈추고 한 번 더 확인한다
   (서울이 목록에 보이면 그쪽이 낫다 — 위 표 참고)
4. 카드 본인 확인 — 확인용이고 Always Free 안에서는 청구되지 않는다
5. 가입 완료 후 콘솔 로그인

## 2. 비용 방어 — 서버 만들기 **전에**

순서가 중요하다. 서버를 먼저 만들고 나중에 막으면, 그 사이에 실수로 유료 자원을 만들 수 있다.

### 예산 알림

**Billing & Cost Management → Budgets** 에서 월 1달러 알림.

**이건 알림이지 차단이 아니다.** 넘어도 자원이 멈추지 않는다.

### Compartment Quota (실제 차단)

**Identity → Compartments → (해당 compartment) → Quotas** 에서 정책을 만든다.

무료 한도를 넘는 생성 자체를 막고, 쓰지 않을 자원 종류는 0 으로 잠근다. 예시:

```
set compute-core quota standard-a1-core-count to 4 in tenancy
zero compute-core quotas in tenancy where request.region != 'ap-tokyo-1'
zero database quotas in tenancy
zero load-balancer quotas in tenancy
```

정확한 정책 이름은 콘솔의 Quota 편집 화면이 목록으로 보여준다. **내가 적은 숫자보다 콘솔이 보여주는
"Always Free Eligible" 표시를 믿는다.**

## 3. 인스턴스 생성

**Compute → Instances → Create instance**

| 항목 | 값 |
|---|---|
| Image | Canonical Ubuntu **22.04** |
| Shape | **Ampere · VM.Standard.A1.Flex** |
| OCPU | 2 |
| Memory | 8 GB |
| Boot volume | 50 GB |
| SSH | **공개키 붙여넣기** (비밀번호 아님) |

### 반드시 확인할 것

- 화면 어딘가에 **`Always Free Eligible`** 배지가 보이는가
- 예상 월 비용이 **0원**인가
- 이미지가 **ARM64(aarch64)** 인가 — A1 은 ARM 이라 x86 이미지는 안 뜬다

### SSH 키를 아직 안 만들었다면

```bash
ssh-keygen -t ed25519 -C "popspot-oracle" -f ~/.ssh/oracle_popspot
```

`~/.ssh/oracle_popspot.pub` 의 내용을 콘솔에 붙여넣는다. **`.pub` 가 아닌 파일은 절대 올리지 않는다.**

## 4. `Out of host capacity` 가 뜨면

흔한 일이다. 무료 ARM 은 자리가 늘 부족하다.

### 도쿄는 AD 가 하나다

`ap-tokyo-1` 은 **단일 AD(Availability Domain)** 리전이다. 그래서 "다른 AD 를 시도하라" 는 조언이
통하지 않는다. Fault Domain 은 용량과 무관하다.

### 할 수 있는 것

| | 방법 | 판단 |
|---|---|---|
| 1 | 시간을 두고 재시도 (새벽·주말 등) | 무료 유지. **가장 먼저 이걸 한다** |
| 2 | 1 OCPU / 6GB 로 낮춰서 시도 | 무료 유지. 작게 시작해 나중에 늘릴 수 있다 |
| 3 | Pay As You Go 전환 | A1 확보가 쉬워지지만 **유료 위험이 생긴다** |
| 4 | 유료 소형 인스턴스 | 월 1~2만원대 |

**3·4 는 사용자 승인 없이 하지 않는다.** 계획서의 중단 조건에 "유료 예상 금액 표시" 가 들어 있다.

### 48시간 규칙

계획서대로 **48시간 안에 안 잡히면 멈추고 보고한다.** 계속 재시도하며 시간을 흘려보내지 않는다.

## 5. 만든 뒤 바로 할 것

```bash
ssh -i ~/.ssh/oracle_popspot ubuntu@<공인 IP>
```

접속되면 1단계 끝이다. 여기부터는 [계획서 2단계(ARM64 검증)](plan-2026-08-oracle-migration.md)로 넘어간다.

### 아직 하지 않는 것

- 80 · 443 열기 → **안 연다.** Cloudflare Tunnel 이 맡는다(4단계)
- 도메인 연결 → 11단계
- `.env` 채우기 → 서버 검증 뒤

## 알아둘 것

**Always Free 인스턴스는 회수될 수 있다.** 7일간 CPU·네트워크·메모리가 모두 낮으면 대상이 된다.
회수 뒤 같은 사양을 즉시 다시 만든다는 보장이 없다.

그래서 이 서버는 "절대 장애 없는 본거지" 가 아니라 **"비용 우선 운영 서버"** 다. 계획서 6단계
(백업)가 선택이 아니라 전제인 이유다.

## 막히면 알려줄 것

- 어느 단계에서 멈췄는지
- 화면에 뜬 오류 문구 그대로
- `Always Free Eligible` 배지가 보였는지
- 예상 비용이 0원이었는지

**콘솔 화면에 카드 번호·계정 이메일이 보이면 가리고 보낸다.**
