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

메뉴: **Governance & Administration → Tenancy Management → Quota policies → Create quota**

(콘솔 검색창에 `Quota policies` 를 쳐도 된다. 다만 검색어는 문서에 없는 편법이고, 위 메뉴 경로가
문서에 적힌 정식 경로다.)

#### 붙여넣을 정책

**12줄 전부를 하나의 정책 안에, 아래 순서 그대로** 넣는다.

```
zero compute-core quotas in tenancy
set compute-core quota standard-a1-core-count to 2 in tenancy where request.region = ap-tokyo-1
zero compute-memory quotas in tenancy
set compute-memory quota standard-a1-memory-count to 12 in tenancy where request.region = ap-tokyo-1
zero block-storage quotas in tenancy
set block-storage quota total-storage-gb to 200 in tenancy where request.region = ap-tokyo-1
set block-storage quota backup-count to 5 in tenancy where request.region = ap-tokyo-1
zero object-storage quotas in tenancy
set object-storage quota storage-bytes to 10000000000 in tenancy where request.region = ap-tokyo-1
zero database quotas in tenancy
zero load-balancer quotas in tenancy
zero container-engine quotas in tenancy
```

#### 왜 이 모양인가

`where request.region != ap-tokyo-1` 같은 **부정 조건은 존재하지 않는다.** 문서에 명시돼 있다 —
조건은 `request.region` 과 `request.ad` 둘뿐이고, 공개된 어떤 예제에도 `=` 외의 연산자가 없다.

그래서 리전 잠금은 **전부 막고 도쿄만 다시 여는** 두 줄짜리 짝으로만 표현된다. Oracle 문서의
"Limit creating dense I/O compute resources to only one region" 예제가 같은 모양이다.

| 짝 | 막는 줄 | 다시 여는 줄 |
|---|---|---|
| CPU | `zero compute-core` | A1 코어 2개 · 도쿄만 |
| 메모리 | `zero compute-memory` | A1 메모리 12GB · 도쿄만 |
| 디스크 | `zero block-storage` | 200GB + 백업 5개 · 도쿄만 |
| 오브젝트 | `zero object-storage` | 10GB · 도쿄만 (DB 백업 보관용) |

**CPU 와 메모리는 서로 다른 패밀리다.** `compute-core` 만 막으면 메모리는 안 막힌다.

#### 절대 하면 안 되는 것

| 하면 | 결과 |
|---|---|
| 두 정책으로 쪼개기 | **인스턴스 생성 불가.** 정책끼리는 가장 엄격한 쪽이 이겨서 `zero` 가 이긴다 |
| 순서 바꾸기 · 정렬하기 | **인스턴스 생성 불가.** 같은 정책 안에서는 뒤 문장이 이긴다 |
| 나중에 `zero` 를 맨 끝에 추가 | **인스턴스 생성 불가.** 위 `set` 을 덮어쓴다 |
| `zero vcn quotas in tenancy` | **인스턴스 생성 불가.** 이 패밀리에 `vcn-count` 가 들어 있어 VCN 자체를 못 만든다 |
| `unset` 을 차단 용도로 사용 | **보호 해제.** `unset` 은 오라클 기본 한도까지 되열어준다 |

#### 저장 후 확인

**최대 10분 걸린다.** 저장 직후 다른 리전에서 생성이 되더라도 정책 실패로 단정하지 않는다.

`Limits, Quotas and Usage` 화면에서 눈으로 확인한다.

| 항목 | 기대값 |
|---|---|
| `standard-a1-core-count` | 2 |
| `standard-a1-memory-count` | 12 |
| `total-storage-gb` | 200 |

**오타가 났을 때 오라클이 거부하는지 조용히 무시하는지는 문서에 없다.** 그래서 눈으로 본다.
`set` 줄에 오타가 나면 `zero` 만 남아 인스턴스를 못 만들고, `zero` 줄에 오타가 나면 보호가 사라진다.

저장이 거부되면 리전 값에 작은따옴표를 씌워 본다(`= 'ap-tokyo-1'`). 오라클 문서 안에서도
따옴표 표기가 엇갈린다.

#### 이 정책이 막지 못하는 것

쿼터는 48개 서비스 중 여기서 이름을 댄 7개만 막는다. 나머지는 열려 있다.

- **OKE 클러스터** — `container-engine` 에는 가상 노드 쿼터밖에 없다
- **MySQL HeatWave** — 문서상 쿼터를 아예 지원하지 않는다
- **Network Load Balancer** — 쿼터 패밀리가 없다 (`load-balancer` 는 구형 LB 전용)
- **A1 컨테이너 인스턴스** — 도쿄에 열어둔 2 OCPU 를 VM 대신 이걸로 쓸 수 있다. 조건절이
  shape 을 못 걸러서 구조적으로 막을 방법이 없다
- **Analytics · Big Data · Data Science · File Storage · API Gateway 등** — 패밀리 이름을
  확인하지 않아 넣지 않았다. 이름을 지어내면 저장은 되고 아무것도 안 막는 게 최악이다

문서에 이렇게 적혀 있다 — **"Service limits always take precedence over quotas."** 쿼터는
조이기만 할 뿐 무료를 보장하지 않는다. **진짜 방어선은 예산 알림이다.**

#### 알아둘 부작용

- 무료 x86 2대(`VM.Standard.E2.1.Micro`)도 같이 막힌다. 쓰려면 정책 **끝에**
  `set compute-core quota standard-e2-micro-core-count to 1 in tenancy where request.region = ap-tokyo-1` 추가
- 무료 Autonomous Database 2개도 막힌다. 쓰려면 `zero database` 줄을 지운다
- **코어 상한이 정확히 2라 재구축 여유가 없다.** 새로 만들고 옛것을 지우는 순서가 안 된다.
  반드시 옛것을 먼저 종료해야 한다
- 코어·메모리·디스크 쿼터는 **AD 당** 값이다. 테넌시 총량이 아니다. 도쿄는 AD 가 하나라 실질
  차이는 없다

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
