# POP-SPOT 웹

서울 팝업스토어의 검색·지도·상세 정보와 찜·코스 화면을 제공하는 Next.js 프로젝트이다.
React와 TypeScript를 사용하며, 스타일은 Tailwind CSS로 관리한다.
의존성 버전은 `package.json`과 `package-lock.json`을 기준으로 확인한다.

## 실행

이 디렉터리에서 의존성을 설치한다.

```bash
npm ci
```

개발 서버를 시작한다.

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

[http://localhost:3000](http://localhost:3000)에서 확인한다.
저장소의 잠금 파일은 npm 기준이다. 다른 패키지 관리자를 사용하면 의존성 해석 결과를 확인한다.

## 구조

| 경로                | 역할                                       |
| ------------------- | ------------------------------------------ |
| `app`               | 페이지, 레이아웃, 서버 라우트              |
| `app/api/[...path]` | 백엔드 API 요청 프록시                     |
| `src/features`      | 검색·팝업·관리자 등 기능별 화면과 로직     |
| `src/components`    | 공용 UI                                    |
| `src/lib`           | API 요청, 다국어, 날짜·좌표 등의 공용 로직 |
| `public`            | 로고, 이미지, 지도 타일 등의 정적 자산     |

## 검사와 운영

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm start
```

환경변수는 `.env.example`과 각 설정 파일의 설명을 따른다. 실제 인증 정보는 커밋하지 않는다.
배포 설정 파일의 존재만으로 현재 운영 환경을 판단하지 않는다.

[개발 안내](../docs/DEVELOPMENT.md)와 [Next.js 문서](https://nextjs.org/docs)를 참고한다.
