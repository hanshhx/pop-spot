package com.example.popspotbackend.service.music;

import com.example.popspotbackend.entity.MusicTrack;
import com.example.popspotbackend.service.ai.UserLlmInvoker;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 음악 트랙의 분위기 키워드 5개를 Groq AI 로 추출한다.
 *
 * <p>화이트리스트({@link #ALLOWED_MOODS}) 안에서만 키워드를 선택하도록 강제해 같은 분위기가 "여름밤" / "한여름밤" / "여름의 밤" 처럼 변형되어
 * 매칭이 비결정적이 되는 것을 막는다.
 *
 * <p>응답이 JSON 배열이 아니거나 허용되지 않은 키워드면 자동 필터링. 그 결과 빈 리스트가 나올 수 있고, 그 경우 호출 측은 매칭 폴백 로직으로 흘러간다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MusicMoodAnalysisService {

    private static final int MAX_TAGS = 5;

    private static final List<String> ALLOWED_MOODS =
            List.of(
                    "청량", "여름", "감성", "빈티지", "레트로", "모던", "시크", "발랄", "차분", "몽환", "로맨틱", "우울",
                    "에너지", "댄스", "재즈", "어쿠스틱", "힙합", "록", "팝", "전자음", "야경", "햇살", "비오는날", "겨울", "봄",
                    "가을", "데이트", "혼자", "친구", "파티", "카페", "산책", "드라이브", "감각적", "트렌디", "키치", "키덜트",
                    "아련", "꿈", "하이틴");

    private final UserLlmInvoker userLlmInvoker;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 곡 메타데이터를 입력으로 받아 무드 키워드 최대 5개 반환. */
    public List<String> analyze(MusicTrack track) {
        String prompt = buildPrompt(track);

        try {
            String response = userLlmInvoker.generate(prompt, "MusicMood");
            return parseMoodTags(response);
        } catch (Exception e) {
            log.warn(
                    "[Mood] Groq 분석 실패: {} - {} → {}",
                    track.getArtistName(),
                    track.getTrackName(),
                    e.toString());
            return List.of();
        }
    }

    private String buildPrompt(MusicTrack track) {
        return """
                당신은 음악 분위기 분석가입니다.
                아래 곡의 분위기를 추출해 한국어 키워드 5개로 답하세요.

                다음 후보 중에서만 5개 선택:
                %s

                응답 형식: JSON 배열만. 다른 텍스트 X.
                예: ["청량","여름","발랄","파스텔","댄스"]

                곡 정보:
                - 아티스트: %s
                - 곡명: %s
                - 앨범: %s
                """
                .formatted(
                        String.join(", ", ALLOWED_MOODS),
                        track.getArtistName(),
                        track.getTrackName(),
                        track.getAlbumName() != null ? track.getAlbumName() : "");
    }

    /**
     * AI 응답에서 JSON 배열을 추출해 화이트리스트 필터링 후 최대 5개 반환. 응답에 잡설이 섞여 있어도 첫 {@code [} 와 마지막 {@code ]} 사이만
     * 잘라낸다.
     */
    private List<String> parseMoodTags(String raw) {
        String json = extractJsonArray(raw);
        if (json == null) return List.of();

        try {
            JsonNode arrayNode = objectMapper.readTree(json);
            return collectAllowedTags(arrayNode);
        } catch (Exception e) {
            log.debug("[Mood] JSON 파싱 실패: {}", json);
            return List.of();
        }
    }

    private String extractJsonArray(String raw) {
        if (raw == null || raw.isBlank()) return null;
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) return null;
        return raw.substring(start, end + 1);
    }

    private List<String> collectAllowedTags(JsonNode arrayNode) {
        List<String> tags = new ArrayList<>();
        for (JsonNode node : arrayNode) {
            String tag = node.asText("").trim();
            if (!tag.isEmpty() && ALLOWED_MOODS.contains(tag)) {
                tags.add(tag);
            }
        }
        return tags.stream().limit(MAX_TAGS).toList();
    }
}
