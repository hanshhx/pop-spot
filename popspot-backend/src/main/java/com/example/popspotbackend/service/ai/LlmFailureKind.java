package com.example.popspotbackend.service.ai;

/** LLM 호출 실패의 종류. 429 를 "결과 없음" 과 섞지 않기 위해 구분한다. */
public enum LlmFailureKind {
    /** 분당 한도(RPM/TPM) 초과. 잠시 기다리면 회복된다. */
    RATE_LIMIT_MINUTE,

    /** 일일 한도(RPD/TPD) 초과. 그날은 회복되지 않으므로 재시도하면 안 된다. */
    RATE_LIMIT_DAY,

    /** 모델이 응답했지만 JSON 파싱에 실패. 프롬프트/모델 품질 문제. */
    PARSE,

    /** 그 외(네트워크, 타임아웃, 인증 등). */
    OTHER
}
