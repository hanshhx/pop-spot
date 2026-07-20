package com.example.popspotbackend.service.ai;

/**
 * 일일 LLM 한도를 소진했음을 알린다.
 *
 * <p>이 예외만 정규화 서비스 밖으로 나간다. 나머지 실패(파싱·네트워크·분당 429)는 그 키워드만 건너뛰면 되지만, 일일 한도는 그날 회복되지 않으므로 크롤 전체를 멈춰야
 * 한다. 실패를 전부 빈 목록으로 뭉개면 "수집 0건" 으로만 보여 원인을 알 수 없다.
 */
public class LlmQuotaExhaustedException extends RuntimeException {

    public LlmQuotaExhaustedException(String message) {
        super(message);
    }
}
