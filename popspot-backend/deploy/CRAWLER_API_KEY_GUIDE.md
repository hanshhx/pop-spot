# 자동수집 API 설정

자동수집은 네이버·카카오 검색 결과를 받아 팝업 정보를 구조화한다.
현재 모델 설정은 `AiConfig.java`와 `application.properties`를 기준으로 확인한다.
Groq의 OpenAI 호환 API를 사용하며, 설정에 따라 로컬 Ollama를 사용할 수 있다.

## 검색 API

| 제공자 | 발급·관리                                          | 환경변수                                 |
| ------ | -------------------------------------------------- | ---------------------------------------- |
| 네이버 | [네이버 개발자 센터](https://developers.naver.com) | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
| 카카오 | [카카오 개발자 센터](https://developers.kakao.com) | `KAKAO_REST_API_KEY`                     |

발급한 앱에서 검색 API 이용 권한과 사용량을 확인한다.
로그인용 앱과 검색용 앱의 키가 같다고 가정하지 않는다.
일일 호출량은 키워드·검색 종류·실행 주기에 따라 달라지므로 고정된 값으로 적지 않는다.
사용 한도와 이용 조건은 제공자의 현재 안내를 확인한다.

## 모델

| 설정               | 용도                    |
| ------------------ | ----------------------- |
| `GROQ_API_KEY`     | Groq 인증               |
| `GROQ_BASE_URL`    | OpenAI 호환 API 주소    |
| `AI_USER_MODEL`    | 사용자 요청용 모델      |
| `AI_CRAWLER_MODEL` | 수집 결과 구조화용 모델 |

로컬 모델의 사용 여부와 주소는 `application.properties`의 `ai.crawler.local.*`와 `ai.translation.local.*` 설정을 확인한다.
과거 Gemini 설정을 현재 Groq 설정과 혼용하지 않는다.
키는 환경변수로 전달하고 로그·문서·커밋에 남기지 않는다.

## 검증

```bash
./gradlew bootRun
```

관리자로 로그인한 뒤 자동수집 화면에서 수집을 실행한다.
검색 API 호출 결과, 모델 오류·호출 제한, 검수 상태와 게시 결과를 확인한다.
원문 링크와 출처를 유지하고, 제공자 약관 준수 여부를 구현만으로 단정하지 않는다.
