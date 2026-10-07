# POP-SPOT 백엔드 배포 안내

백엔드는 Java 21 기반 Spring Boot 애플리케이션이다.
이 문서의 빌드 명령은 `popspot-backend` 디렉터리에서 실행한다.
서버 주소, 접속 계정, 배포 경로는 실제 운영 환경에서 확인한다.

## 빌드와 검사

```bash
./gradlew spotlessCheck test bootJar
```

Windows에서는 `gradlew.bat spotlessCheck test bootJar`를 사용한다.
실행 가능한 JAR는 `build/libs`에 생성된다. `*-plain.jar`와 구분한다.
GitHub Actions의 `Quality` 작업도 같은 검사를 실행하고 `popspot-backend-jar` 아티팩트를 보관한다.

## 배포 전 확인

- 현재 실행 중인 JAR와 환경변수 설정을 백업한다.
- `application.properties`, `.env.example`, 서버의 환경변수 이름이 일치하는지 확인한다.
- PostgreSQL·Redis 연결과 Flyway 마이그레이션 적용 영향을 확인한다.
- 빌드한 JAR를 실제 서비스 설정의 실행 경로에 배치하고 재시작한다.
- `/api/popups` 응답, 비로그인 인증 응답, 로그인 후 주요 기능을 확인한다.
- 실패하면 기존 JAR와 설정으로 복원한다. 데이터베이스 변경은 별도의 복구 절차로 다룬다.

## 참고 자료

- [개발 안내](../../docs/DEVELOPMENT.md)
- [자동수집 API 설정](CRAWLER_API_KEY_GUIDE.md)
- [과거 Oracle 이전 계획](../../docs/plan-2026-08-oracle-migration.md)

과거 GCP 서버의 주소와 접속 명령은 현재 배포 절차로 사용하지 않는다.
이전 계획 문서는 작성 당시 기록이며 현재 서버 상태를 증명하지 않는다.
