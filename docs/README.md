# docs

운영·판단 근거를 남기는 곳. 코드 주석이 "이 줄이 왜 이런가" 를 답한다면, 여기는
**"이 결정이 왜 이랬는가"** 를 답한다.

숫자가 들어간 문서는 파일명에 잰 날짜를 붙인다 — 다시 재면 달라지는 값이라,
언제 기준인지 모르면 근거로 쓸 수 없다.

| 문서 | 내용 |
|---|---|
| [plan-2026-08-security-analytics.md](plan-2026-08-security-analytics.md) | 보안·분석 플랜(A~D)의 진행 상태와 결정 근거. 만든 가드와 그 가드가 새어 나갔던 사례 포함 |
| [seo-findings-2026-08-05.md](seo-findings-2026-08-05.md) | 유입 구조·사이트맵·상세 색인 실측. 네이버 API 약관 검토 결과 |
| [runbook-firewall-lockout.md](runbook-firewall-lockout.md) | 방화벽에 스스로 잠겼을 때의 긴급 해제 절차 (A-4) |
| [runbook-search-index-request.md](runbook-search-index-request.md) | 색인 요청 절차. 목록 생성기와 거르는 기준, 넣기 전 확인할 것 |
| [search-index-request-list.txt](search-index-request-list.txt) | 위 절차로 뽑은 요청 목록. `scripts/index-request-list.mjs` 로 다시 만든다 |

## 쓸 때 지킬 것

- **실측한 값만 적는다.** 추정이면 추정이라고 쓴다.
- **뒤집힌 판단을 지우지 않는다.** "노출만 보고 잘랐으면 최근에 만든 걸 잘라낼
  뻔했다" 같은 기록이 다음 사람을 같은 함정에서 구한다.
- **한계를 함께 적는다.** "재방문율은 하한이다" 를 안 적으면 그 숫자가 언젠가
  사실로 인용된다.
