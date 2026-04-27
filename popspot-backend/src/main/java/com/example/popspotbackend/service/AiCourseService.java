package com.example.popspotbackend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiCourseService {

    private final ChatLanguageModel chatLanguageModel;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<Map<String, Object>> recommendCourse(String vibe) {
        log.info("🤖 LangChain4j (Gemini) 요청 시작: '{}'", vibe);

        // 1. 프롬프트: JSON 포맷을 강제하는 것이 핵심
        String prompt = String.format(
                "서울 성수동에서 '%s' 분위기에 딱 맞는 팝업스토어, 핫플 카페, 맛집 등 5곳을 추천해서 투어 코스를 짜줘.\n" +
                        "조건 1: 반드시 아래 JSON 배열 포맷으로만 답변해. 마크다운(```json)이나 잡담 금지.\n" +
                        "조건 2: 좌표(lat, lng)는 실제 성수동 좌표로 넣어.\n" +
                        "[\n" +
                        "  {\n" +
                        "    \"id\": \"1\",\n" +
                        "    \"name\": \"장소명\",\n" +
                        "    \"lat\": 37.5445,\n" +
                        "    \"lng\": 127.0560,\n" +
                        "    \"category\": \"카테고리\",\n" +
                        "    \"reason\": \"추천 이유\"\n" +
                        "  }\n" +
                        "]",
                vibe
        );

        try {
            // 2. LangChain4j 호출
            String response = chatLanguageModel.generate(prompt);
            log.info("✅ Gemini 응답 수신: {}", response);

            // 3. JSON 파싱
            return parseResponse(response);

        } catch (Exception e) {
            // [수정됨] 에러의 전체 스택 트레이스를 로그에 남겨야 진짜 원인을 알 수 있습니다.
            // e 뒤에 e를 한번 더 써주면 에러의 상세 내용이 로그에 출력됩니다.
            log.error("❌ LangChain4j 호출 중 치명적 에러 발생: ", e);

            // [수정됨] 클라이언트에게도 구체적인 에러 내용을 전달하지 않고, 서버 로그를 확인하라는 메시지로 변경하거나
            // 현재처럼 e.getMessage()를 유지하되, 위 로그를 통해 서버 콘솔에서 원인을 찾아야 합니다.
            throw new RuntimeException("AI 서버 연결 실패: " + e.getMessage());
        }
    }

    private List<Map<String, Object>> parseResponse(String responseText) {
        try {
            // ```json ... ``` 제거 로직
            String cleanJson = responseText.replaceAll("```json", "")
                    .replaceAll("```", "")
                    .trim();

            // 리스트로 변환
            List<Map<String, Object>> result = objectMapper.readValue(cleanJson, List.class);

            // ID를 String으로 안전하게 변환 (프론트 호환성)
            for (Map<String, Object> item : result) {
                if (item.get("id") != null) {
                    item.put("id", String.valueOf(item.get("id")));
                }
            }
            return result;
        } catch (Exception e) {
            log.error("JSON 파싱 실패", e);
            return Collections.emptyList(); // 실패 시 빈 리스트 반환
        }
    }
}