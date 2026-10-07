# 개발·운영 문서

개발 기준과 운영 절차, 과거 결정의 근거를 정리한다.
날짜가 있는 계획·측정 문서는 당시 기록이며 현재 배포 상태와 구분한다.

| 문서                                                                     | 내용                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [DEVELOPMENT.md](DEVELOPMENT.md)                                         | 프로젝트 구조, 개발 기준, 검사와 문서 작성 규칙                                                        |
| [plan-2026-08-security-analytics.md](plan-2026-08-security-analytics.md) | 보안·분석 플랜(A~D)의 진행 상태와 결정 근거. 만든 가드와 그 가드가 새어 나갔던 사례 포함               |
| [plan-2026-08-oracle-migration.md](plan-2026-08-oracle-migration.md)     | 백엔드를 Oracle Cloud 로 옮기는 계획. 공개 데이터와 회원 데이터를 나눠 다루는 이유, 분기점과 중단 조건 |
| [seo-findings-2026-08-05.md](seo-findings-2026-08-05.md)                 | 유입 구조·사이트맵·상세 색인 실측. 네이버 API 약관 검토 결과                                           |
| [runbook-oracle-server-setup.md](runbook-oracle-server-setup.md)         | Oracle 서버 생성 절차(계획 1단계). 홈 리전·비용 방어·용량 부족 대처                                    |
| [runbook-firewall-lockout.md](runbook-firewall-lockout.md)               | 방화벽에 스스로 잠겼을 때의 긴급 해제 절차 (A-4)                                                       |
| [runbook-search-index-request.md](runbook-search-index-request.md)       | 색인 요청 절차. 목록 생성기와 거르는 기준, 넣기 전 확인할 것                                           |
| [search-index-request-list.txt](search-index-request-list.txt)           | 위 절차로 뽑은 요청 목록. `scripts/index-request-list.mjs` 로 다시 만든다                              |
| [runbook-translation-backfill.md](runbook-translation-backfill.md)       | 팝업 번역 백필 절차                                                                                    |

## 쓸 때 지킬 것

과거 데이터 보정 SQL은 `maintenance/`에 보관한다. 파일에 기록된 대상과 전제 조건을 확인한 뒤 사용한다.

- 측정값에는 날짜와 조건을 적고 추정값과 구분한다.
- 결정이 바뀌면 이전 판단과 변경 이유를 함께 남긴다.
- 데이터와 검증 범위의 한계를 명시한다.
