package com.example.popspotbackend.service.music;

import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * 한국어 검색어를 Spotify 가 잘 잡는 영문 표기로 변환한다.
 *
 *   "뉴진스"           → "NewJeans"
 *   "잔나비"           → "Jannabi"
 *   "한 페이지가 될 수 있게"   → "DAY6 한 페이지가 될 수 있게"
 *   "벚꽃엔딩"         → "Busker Busker Cherry Blossom Ending"
 *
 * Spotify 한국어 매칭이 약한 경우(예: 가수명이 영문으로만 등록된 경우)
 * 이 정규화를 거쳐 영문/혼합 표기로 재검색하면 잘 잡힌다.
 *
 * 같은 입력은 메모리 캐시되어 같은 검색어 두 번째부터는 외부 호출이 없다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MusicQueryNormalizationService {

    private static final String SYSTEM_PROMPT = """
            너는 한국 음악 검색을 위한 표기 변환 도우미다.
            입력 한국어 검색어를 Spotify 에서 매칭이 잘 되는 표기로 바꿔서 답한다.

            규칙:
              - 답변은 한 줄, 다른 설명/문장부호/괄호 절대 금지
              - 가수명은 가능하면 영문 정식 표기 (NewJeans, Jannabi, DAY6, IU, BTS 등)
              - 곡명이 한국어인 경우 가수 영문 + 곡 한국어 형식
              - 모호하거나 모르겠으면 입력을 그대로 돌려준다

            예시:
              입력: 뉴진스                   → 출력: NewJeans
              입력: 잔나비                   → 출력: Jannabi
              입력: 데이식스                 → 출력: DAY6
              입력: 아이유                   → 출력: IU
              입력: 비투비                   → 출력: BTOB
              입력: 방탄소년단               → 출력: BTS
              입력: 한 페이지가 될 수 있게   → 출력: DAY6 한 페이지가 될 수 있게
              입력: 벚꽃엔딩                 → 출력: Busker Busker 벚꽃엔딩
              입력: super shy                → 출력: NewJeans Super Shy
              입력: 사랑                     → 출력: 사랑
            """;

    private final ChatLanguageModel chatModel;
    private final ConcurrentMap<String, String> cache = new ConcurrentHashMap<>();

    /**
     * 정규화된 검색어를 반환. AI 호출이 실패하면 입력을 그대로 돌려준다.
     */
    public String normalize(String raw) {
        if (raw == null || raw.isBlank()) return raw;
        String key = raw.trim();

        String cached = cache.get(key);
        if (cached != null) return cached;

        String result = askModel(key);
        cache.put(key, result);
        return result;
    }

    private String askModel(String query) {
        try {
            String prompt = SYSTEM_PROMPT + "\n\n입력: " + query + "\n출력:";
            String raw = chatModel.generate(UserMessage.from(prompt)).content().text();

            String cleaned = clean(raw);
            if (cleaned.isBlank() || cleaned.length() > 80) return query;
            return cleaned;
        } catch (Exception e) {
            log.warn("[음악 정규화] 실패: {} → {}", query, e.toString());
            return query;
        }
    }

    private String clean(String raw) {
        if (raw == null) return "";
        String s = raw.trim();
        if (s.startsWith("출력:") || s.startsWith("출력 :")) {
            s = s.substring(s.indexOf(':') + 1).trim();
        }
        s = s.replaceAll("[\"'`]", "");
        s = s.replaceAll("\\s+", " ").trim();
        int newline = s.indexOf('\n');
        if (newline > 0) s = s.substring(0, newline).trim();
        return s;
    }
}
