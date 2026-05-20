package com.example.popspotbackend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * LLM 으로 성수동 코스를 동적으로 추천한다.
 *
 * <p>프롬프트에서 JSON 배열만 출력하도록 강제하고, 응답 파싱 시 마크다운 펜스를 제거한 뒤 id 필드를 항상 문자열로 정규화해 프론트 호환성을 보장한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiCourseService {

    private static final String PROMPT_TEMPLATE =
            """
            서울 성수동에서 '%s' 분위기에 딱 맞는 팝업스토어, 핫플 카페, 맛집 등 5곳을 추천해서 투어 코스를 짜줘.
            조건 1: 반드시 아래 JSON 배열 포맷으로만 답변해. 마크다운(```json)이나 잡담 금지.
            조건 2: 좌표(lat, lng)는 실제 성수동 좌표로 넣어.
            [
              {
                "id": "1",
                "name": "장소명",
                "lat": 37.5445,
                "lng": 127.0560,
                "category": "카테고리",
                "reason": "추천 이유"
              }
            ]
            """;

    private final ChatLanguageModel chatLanguageModel;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<Map<String, Object>> recommendCourse(String vibe) {
        log.info("[AiCourse] 추천 요청 vibe='{}'", vibe);
        try {
            String response = chatLanguageModel.generate(String.format(PROMPT_TEMPLATE, vibe));
            return parseResponse(response);
        } catch (Exception e) {
            log.error("[AiCourse] LLM 호출 실패", e);
            // 외부 서비스(LLM) 장애 → 5xx 가 의미상 맞지만 GlobalExceptionHandler 가 IllegalStateException
            // 을 409 로 잡고 있어, 클라이언트는 동일한 에러 메시지를 받음. 메시지에 원인을 담아 디버깅 가능.
            throw new IllegalStateException("AI 서버 연결 실패: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseResponse(String responseText) {
        try {
            String cleanJson = stripMarkdownFences(responseText);
            List<Map<String, Object>> result = objectMapper.readValue(cleanJson, List.class);
            normalizeIdFields(result);
            return result;
        } catch (Exception e) {
            log.error("[AiCourse] JSON 파싱 실패", e);
            return Collections.emptyList();
        }
    }

    private String stripMarkdownFences(String response) {
        return response.replaceAll("```json", "").replaceAll("```", "").trim();
    }

    /** 프론트는 id 를 문자열로 다루기 때문에 LLM 이 숫자로 내려도 강제로 String 화 한다. */
    private void normalizeIdFields(List<Map<String, Object>> result) {
        for (Map<String, Object> item : result) {
            if (item.get("id") != null) {
                item.put("id", String.valueOf(item.get("id")));
            }
        }
    }
}
