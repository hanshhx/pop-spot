package com.example.popspotbackend.service.music;

import com.example.popspotbackend.entity.MusicTrack;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 음악 트랙의 분위기 키워드 5개를 Groq AI 로 추출.
 * 추출된 키워드는 popup_store 의 mood/카테고리와 매칭에 사용.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MusicMoodAnalysisService {

    private final ChatLanguageModel chatLanguageModel;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final List<String> ALLOWED_MOODS = List.of(
            "청량", "여름", "감성", "빈티지", "레트로", "모던", "시크",
            "발랄", "차분", "몽환", "로맨틱", "우울", "에너지", "댄스",
            "재즈", "어쿠스틱", "힙합", "록", "팝", "전자음", "야경",
            "햇살", "비오는날", "겨울", "봄", "가을", "데이트", "혼자",
            "친구", "파티", "카페", "산책", "드라이브", "감각적", "트렌디",
            "키치", "키덜트", "아련", "꿈", "하이틴"
    );

    /** 곡 정보 → 무드 키워드 5개 추출 (Groq Llama-3.3) */
    public List<String> analyze(MusicTrack track) {
        String prompt = """
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
                """.formatted(
                String.join(", ", ALLOWED_MOODS),
                track.getArtistName(),
                track.getTrackName(),
                track.getAlbumName() != null ? track.getAlbumName() : ""
        );

        try {
            String response = chatLanguageModel.generate(prompt);
            return parseMoodTags(response);
        } catch (Exception e) {
            log.warn("[Mood] Groq 분석 실패: {} - {} → {}",
                    track.getArtistName(), track.getTrackName(), e.toString());
            return List.of();
        }
    }

    private List<String> parseMoodTags(String raw) {
        if (raw == null || raw.isBlank()) return List.of();

        // JSON 부분만 추출 ([...] 형태)
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) return List.of();

        String json = raw.substring(start, end + 1);
        try {
            JsonNode arr = mapper.readTree(json);
            List<String> tags = new ArrayList<>();
            for (JsonNode n : arr) {
                String tag = n.asText("").trim();
                if (!tag.isEmpty() && ALLOWED_MOODS.contains(tag)) {
                    tags.add(tag);
                }
            }
            // 5개로 제한
            return tags.stream().limit(5).toList();
        } catch (Exception e) {
            log.debug("[Mood] JSON 파싱 실패: {}", json);
            return List.of();
        }
    }
}
