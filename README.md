# POP-SPOT

팝업스토어 큐레이션 / 동행 매칭 / 코스 플래닝 서비스.

## 구조

- `popspot-backend/` — Spring Boot 4 / Java 21 / PostgreSQL / Redis
- `popspot-frontend/` — Next.js 16 / React 19 / Tailwind / STOMP

## 빌드 / 실행

각 폴더의 README 또는 `popspot-backend/deploy/README_DEPLOY.md` 참고.

## 환경변수

`popspot-backend/.env.example`, `popspot-frontend/.env.example` 참고.
실제 시크릿은 절대 git 에 커밋하지 않습니다.

## 보안 정책

- 모든 시크릿은 환경변수로 주입
- JWT 시크릿 32B+ 강제 부팅 검증
- BCrypt strength=12
- CORS 화이트리스트 only
- 결제는 PortOne 서버 검증 (위변조 시 자동 환불)
- Rate Limit: login 5/min, email send 5/hr, verify 10/min
- 자세한 변경 이력: `popspot-backend/deploy/DEPLOY_CHECKLIST.md`
