package com.example.popspotbackend.service.music;

import com.example.popspotbackend.service.ai.UserLlmInvoker;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 한국어 검색어를 Spotify 가 잘 매칭하는 영문 정식 표기로 변환한다.
 *
 * <p>Spotify 한국 카탈로그가 가수명을 영문으로만 등록한 경우 (예: NewJeans, DAY6), 한국어 입력은 음성학적 매칭 때문에 엉뚱한 곡이 잡힌다. 이 정규화를
 * 거치면 Spotify 매칭 정확도가 크게 올라간다.
 *
 * <p>같은 입력은 메모리 캐시되어 첫 호출 후 외부 LLM 호출이 발생하지 않는다.
 *
 * <pre>
 *   "뉴진스"                  → "NewJeans"
 *   "잔나비"                  → "Jannabi"
 *   "한 페이지가 될 수 있게"  → "DAY6 한 페이지가 될 수 있게"
 *   "벚꽃엔딩"                → "Busker Busker 벚꽃엔딩"
 * </pre>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MusicQueryNormalizationService {

    private static final int MAX_NORMALIZED_LENGTH = 80;
    private static final String OUTPUT_PREFIX_FULL = "출력:";
    private static final String OUTPUT_PREFIX_SPACED = "출력 :";

    private static final String SYSTEM_PROMPT =
            """
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

    private final UserLlmInvoker userLlmInvoker;
    private final ConcurrentMap<String, String> normalizationCache = new ConcurrentHashMap<>();

    /** AI 호출이 실패하면 입력을 그대로 돌려준다. */
    public String normalize(String raw) {
        if (isBlank(raw)) return raw;

        String key = raw.trim();
        String cached = normalizationCache.get(key);
        if (cached != null) return cached;

        String normalized = requestNormalizationFromModel(key);
        normalizationCache.put(key, normalized);
        return normalized;
    }

    private String requestNormalizationFromModel(String query) {
        try {
            String prompt = SYSTEM_PROMPT + "\n\n입력: " + query + "\n출력:";
            String rawResponse = userLlmInvoker.generate(prompt, "MusicQuery");

            String cleaned = cleanResponse(rawResponse);
            return isValidNormalization(cleaned) ? cleaned : query;
        } catch (Exception e) {
            log.warn("[음악 정규화] 실패: {} → {}", query, e.toString());
            return query;
        }
    }

    /** AI 응답에서 "출력:" 접두어, 따옴표, 줄바꿈, 다중 공백을 제거한다. */
    private String cleanResponse(String raw) {
        if (raw == null) return "";

        String cleaned = raw.trim();
        cleaned = stripOutputPrefix(cleaned);
        cleaned = cleaned.replaceAll("[\"'`]", "");
        cleaned = cleaned.replaceAll("\\s+", " ").trim();
        cleaned = firstLineOnly(cleaned);
        return cleaned;
    }

    private String stripOutputPrefix(String s) {
        if (s.startsWith(OUTPUT_PREFIX_FULL) || s.startsWith(OUTPUT_PREFIX_SPACED)) {
            return s.substring(s.indexOf(':') + 1).trim();
        }
        return s;
    }

    private String firstLineOnly(String s) {
        int newlineIndex = s.indexOf('\n');
        return newlineIndex > 0 ? s.substring(0, newlineIndex).trim() : s;
    }

    private boolean isValidNormalization(String cleaned) {
        return !cleaned.isBlank() && cleaned.length() <= MAX_NORMALIZED_LENGTH;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
