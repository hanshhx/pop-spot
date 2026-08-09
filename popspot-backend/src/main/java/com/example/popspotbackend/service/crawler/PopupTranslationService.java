package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.ai.CrawlerLlm;
import com.example.popspotbackend.service.ai.LlmErrors;
import com.example.popspotbackend.service.ai.LlmUsageTracker;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.model.output.TokenUsage;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 팝업 이름·장소를 영어·일본어 표시용으로 옮긴다.
 *
 * <p><b>번역이 아니라 되돌리기다.</b> 한국 팝업 이름의 상당수는 외국 브랜드·IP를 한글로 적어 둔 것이라 (진격의 거인 = Attack on Titan, 에르메스 =
 * Hermès, 니텐도 = Nintendo), 외국인이 읽어도 자기가 아는 이름인 줄 모른다. 음역하면 아무 소용이 없고 원래 이름을 찾아 줘야 한다.
 *
 * <p>실제 이름 60건으로 미리 재 본 결과 87%가 그대로 쓸 만했다. 남은 실패는 대부분 <b>확신 없이 지어낸 이름</b>이었고, 그중에는 관광객을 다른 장소로 보내는
 * 것도 있었다(현대백화점 → The Hyundai 는 여의도의 별개 매장이다). 그래서 확신이 낮으면 <b>비워 두고 한국어 원문을 그대로 보여준다.</b>
 *
 * <p>같은 측정에서 드러난 더 중요한 사실 — 번역명은 무엇인지 알려주는 데는 좋지만 <b>찾는 데는 못 쓴다.</b> 지도 앱에 "Knotted World" 를 넣으면 안
 * 나오고 직원에게 말해도 통하지 않는다. 그래서 화면은 번역명과 원문을 <b>함께</b> 보여준다. 이 서비스가 원문을 절대 덮어쓰지 않는 이유이기도 하다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupTranslationService {

    /**
     * 한 번에 넘길 팝업 수.
     *
     * <p>이름은 스니펫보다 훨씬 짧아 크롤 정규화(5건)보다 크게 잡을 수 있다. 다만 너무 키우면 응답이 길어져 뒤쪽 항목의 품질이 떨어지고, 한 건이 깨지면 배치
     * 전체를 잃는다.
     */
    private static final int BATCH_SIZE = 20;

    private final CrawlerLlm crawlerLlm;
    private final LlmUsageTracker usageTracker;
    private final OllamaTranslationClient ollamaTranslationClient;
    private final PopupTranslationGlossary glossary;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 켜면 번역을 로컬 Ollama 로만 돌린다. <b>기본값은 꺼짐이다.</b>
     *
     * <p>원래는 켜져 있었다. "번역은 있으면 좋은 것이니 유료·쿼터 제한 Groq 를 쓰면서까지 할 일은 아니다" 는 판단이었다. 그런데 로컬 Ollama 는 운영자
     * PC 에서 돈다. PC 가 꺼져 있으면 번역이 <b>실패</b>하는 게 아니라 조용히 보류되고, 그래서 백필을 눌러도 아무 일이 안 일어난다 — 실제로
     * 2026-08-09 에 100건을 걸었더니 100건 전부 보류로 돌아왔다.
     *
     * <p>넘겨도 수집이 굶지 않는다. {@code translateBatch} 가 클라우드를 고르기 전에 {@link
     * LlmUsageTracker#isDailyQuotaExhausted} 를 보고, 한도가 소진됐으면 번역 쪽이 먼저 물러난다. 한 배치가 {@value
     * #BATCH_SIZE} 건이라 남은 600여 건도 서른 번 남짓이다.
     *
     * <p>PC 를 켜 두는 운영이라면 {@code POPSPOT_TRANSLATION_LOCAL_ONLY=true} 로 되돌리면 된다.
     */
    @Value("${popspot.crawler.translation-local-only:false}")
    private boolean localOnly;

    /** 번역 한 벌. 확신이 없으면 해당 칸이 null 이다. */
    public record Translated(String nameEn, String nameJa, String locationEn, String locationJa) {

        public boolean isEmpty() {
            return nameEn == null && nameJa == null && locationEn == null && locationJa == null;
        }
    }

    /**
     * 팝업 묶음을 번역한다.
     *
     * <p>실패해도 예외를 밖으로 내보내지 않는다 — 번역은 <b>있으면 좋은 것</b>이라, 못 했다고 수집이나 백필 전체가 멈추면 안 된다. 못 한 건은 결과에서 빠지고
     * 호출자가 원문을 그대로 쓴다.
     *
     * @return 팝업 id → 번역. 정상 응답에서 확신이 없어 비운 id는 빈 {@link Translated}로 들어가고, 호출 실패·응답 누락 id는 들어 있지
     *     않다.
     */
    public Map<Long, Translated> translate(List<PopupStore> popups) {
        Map<Long, Translated> result = new HashMap<>();
        if (popups == null || popups.isEmpty()) {
            return result;
        }

        for (int from = 0; from < popups.size(); from += BATCH_SIZE) {
            List<PopupStore> batch =
                    popups.subList(from, Math.min(from + BATCH_SIZE, popups.size()));
            try {
                result.putAll(translateBatch(batch));
            } catch (Exception e) {
                // 배치 하나가 깨져도 나머지는 계속한다.
                log.warn("[PopupTranslation] 배치 실패({}건) — 건너뜀: {}", batch.size(), e.getMessage());
            }
        }
        return result;
    }

    private Map<Long, Translated> translateBatch(List<PopupStore> batch) {
        List<ProtectedPopup> protectedBatch = protect(batch);
        String prompt = buildPrompt(protectedBatch);

        if (localOnly) {
            return translateLocally(prompt, protectedBatch);
        }

        CrawlerLlm.Selection selection = crawlerLlm.select();

        // 클라우드 한도는 크롤과 공유한다. 번역이 한도를 다 써서 정작 수집이 막히면 안 되므로,
        // 소진 상태면 조용히 포기한다(예외를 던지지 않는다 — 위 주석의 '있으면 좋은 것' 원칙).
        if (!selection.local()
                && usageTracker.isDailyQuotaExhausted(LlmUsageTracker.Role.CRAWLER)) {
            log.info("[PopupTranslation] 클라우드 일일 한도 소진 — 이번 배치는 건너뜁니다");
            return Map.of();
        }

        usageTracker.recordAttempt(LlmUsageTracker.Role.CRAWLER);

        Response<AiMessage> response;
        try {
            response = selection.model().generate(List.of(new UserMessage(prompt)));
        } catch (Exception e) {
            usageTracker.recordFailure(LlmUsageTracker.Role.CRAWLER, LlmErrors.classify(e));
            if (selection.local()) {
                crawlerLlm.markLocalUnavailable();
            }
            throw new IllegalStateException("LLM 호출 실패: " + e.getMessage(), e);
        }
        recordTokens(response.tokenUsage());

        return parse(response.content().text(), protectedBatch);
    }

    private Map<Long, Translated> translateLocally(
            String prompt, List<ProtectedPopup> protectedBatch) {
        if (!ollamaTranslationClient.isAvailable()) {
            log.info("[PopupTranslation] 번역용 Ollama를 사용할 수 없어 이번 배치를 보류합니다");
            return Map.of();
        }

        usageTracker.recordAttempt(LlmUsageTracker.Role.CRAWLER);
        try {
            OllamaTranslationClient.TranslationResponse response =
                    ollamaTranslationClient.translate(prompt);
            usageTracker.recordResponse(
                    LlmUsageTracker.Role.CRAWLER, response.inputTokens(), response.outputTokens());
            return parse(response.content(), protectedBatch);
        } catch (Exception e) {
            usageTracker.recordFailure(LlmUsageTracker.Role.CRAWLER, LlmErrors.classify(e));
            throw new IllegalStateException("Ollama 번역 호출 실패: " + e.getMessage(), e);
        }
    }

    private List<ProtectedPopup> protect(List<PopupStore> batch) {
        List<ProtectedPopup> protectedBatch = new ArrayList<>(batch.size());
        for (PopupStore popup : batch) {
            protectedBatch.add(
                    new ProtectedPopup(
                            popup,
                            glossary.protect(popup.getName()),
                            glossary.protect(popup.getLocation())));
        }
        return protectedBatch;
    }

    /**
     * 프롬프트.
     *
     * <p>지시가 긴 이유는 <b>측정에서 드러난 실패를 하나씩 막기 위해서</b>다. 음역으로 흐르는 것, 공식 행사명을 무시하고 조합하는 것, 고유명을 업종명으로 풀어
     * 버리는 것("한복상점" → "Hanbok Shop" 은 서울에 수백 개 있는 업태명이 된다) 이 실제로 나왔다.
     */
    private String buildPrompt(List<ProtectedPopup> batch) {
        StringBuilder items = new StringBuilder();
        for (ProtectedPopup protectedPopup : batch) {
            PopupStore p = protectedPopup.popup();
            items.append("- id: ").append(p.getId()).append('\n');
            items.append("  name: ").append(safe(protectedPopup.name().masked())).append('\n');
            if (p.getLocation() != null && !p.getLocation().isBlank()) {
                items.append("  location: ")
                        .append(safe(protectedPopup.location().masked()))
                        .append('\n');
            }
        }

        return """
        /no_think
        서울 팝업스토어 안내 서비스의 영어·일본어 화면에 쓸 이름을 만든다.

        # 핵심: 번역이 아니라 "원래 이름 복원"이다
        한국 팝업 이름의 상당수는 외국 브랜드·IP를 한글로 옮겨 적은 것이다.
        그 경우 뜻을 옮기지 말고 원래 이름을 되살려라.
          에르메스 -> Hermes / エルメス          (Ereumeseu 같은 음역 금지)
          진격의 거인 -> Attack on Titan / 進撃の巨人   (일본 원작은 일본어 원제로)
          니텐도 -> Nintendo / 任天堂
          귀멸의 칼날 -> Demon Slayer / 鬼滅の刃

        # 종류별 처리
        - 세계적 IP·브랜드: 공식 영어명/일본어명을 복원한다.
        - 한국 브랜드: 그 브랜드의 공식 로마자 표기(설화수 -> Sulwhasoo). 없으면 표준 로마자.
        - 장소·건물: 공식 표기 우선(코엑스 -> COEX, 더현대 서울 -> The Hyundai Seoul).
        - 뜻만 있는 서술어구: 의미를 옮긴다("산지 직송 감자 마켓" -> "Farm-Direct Potato Market").
        - 일반명사는 그 언어의 말로: 팝업스토어 -> pop-up store / ポップアップストア

        # 이름(name)과 장소(location)는 규칙이 다르다
        - name: 모르는 브랜드라도 <b>소리 나는 대로</b> 옮겨라. 영어는 로마자, 일본어는 가타카나.
            와릿이즌 -> Whatitisnt / ワリットイズン
            메디큐브 -> medicube / メディキューブ
          뜻을 옮기려 하지 마라. "글로우 서울" 은 Glow Seoul / グロウソウル 이지 光る首都가 아니다.
        - location: <b>확신이 없으면 null.</b> 장소를 잘못 적으면 사람이 다른 동네로 간다.
          실제로 "남대문" 이 "南山"(남산)으로 나온 적이 있다. 모르면 비워라.

        # 반드시 지킬 것
        1. location 은 확신이 없으면 그 칸을 null 로 둬라. 빈 값은 한국어 원문으로 표시되므로 안전하다.
        2. 없는 정보를 덧붙이지 마라. 원문에 없는 층수·번지·연도를 만들지 마라.
           실제로 "…더현대 서울" 에 없던 "1F" 가 붙어 나온 적이 있다.
        3. 일본어 칸에 중국어를 쓰지 마라. 한자만 늘어놓지 말고 가나를 섞어 일본어로 적어라.
        3. 고유명사를 업종 일반명사로 풀지 마라.
           "한복상점" -> "Hanbok Shop" (X) — 서울에 수백 개 있는 업태명이 되어 특정이 안 된다.
        4. 공식 행사명이 따로 있으면 그것을 써라. 단어를 임의로 조합하지 마라.
        5. location 은 대부분 번지가 아니라 장소 이름이다. 층수는 그대로 옮긴다(지하 1층 -> B1 / 地下1階).
        6. ZXQTERM0QXZ 같은 보호 토큰은 철자·대소문자·위치를 그대로 유지한다. 번역하거나 생략하지 마라.
           보호 토큰은 검증된 공식 이름이며 응답을 받은 뒤 서버가 정확한 표기로 복원한다.

        # 출력
        JSON 배열만. 설명·코드펜스 없이.
        [{"id":123,"nameEn":"...","nameJa":"...","locationEn":"...","locationJa":"..."}]
        확신 없는 칸은 null. 항목을 빠뜨리지 말고 입력 순서대로.

        # 입력
        %s
        """
                .formatted(items.toString().trim());
    }

    private Map<Long, Translated> parse(String raw, List<ProtectedPopup> batch) {
        Map<Long, ProtectedPopup> byId = new HashMap<>();
        for (ProtectedPopup p : batch) {
            byId.put(p.popup().getId(), p);
        }

        JsonNode array;
        try {
            String cleaned = raw.replaceAll("```json", "").replaceAll("```", "").trim();
            JsonNode root = objectMapper.readTree(cleaned);
            array = root.isArray() ? root : root.path("results");
        } catch (Exception e) {
            log.warn("[PopupTranslation] 응답 파싱 실패 — 배치 건너뜀: {}", e.getMessage());
            return Map.of();
        }
        if (!array.isArray()) {
            return Map.of();
        }

        Map<Long, Translated> out = new HashMap<>();
        for (JsonNode node : array) {
            JsonNode idNode = node.path("id");
            if (!idNode.canConvertToLong()) continue;
            long id = idNode.asLong();
            ProtectedPopup protectedPopup = byId.get(id);
            if (protectedPopup == null) continue; // 입력에 없던 id 를 지어낸 경우
            PopupStore source = protectedPopup.popup();

            Translated t =
                    new Translated(
                            restoreName(
                                    clean(node, "nameEn", source.getName()),
                                    protectedPopup.name(),
                                    source.getName(),
                                    true),
                            restoreName(
                                    clean(node, "nameJa", source.getName()),
                                    protectedPopup.name(),
                                    source.getName(),
                                    false),
                            restoreLocation(
                                    clean(node, "locationEn", source.getLocation()),
                                    protectedPopup.location(),
                                    true),
                            restoreLocation(
                                    clean(node, "locationJa", source.getLocation()),
                                    protectedPopup.location(),
                                    false));
            // 정상 JSON에 이 id가 있었다는 사실도 결과다. 네 칸이 모두 null이어도 "확신 없어 비움"으로
            // 기록하고, 호출 실패나 응답 누락은 map에 넣지 않아 다음 회차에서 재시도한다.
            out.put(id, t);
        }
        return out;
    }

    private String restoreName(
            String translated,
            PopupTranslationGlossary.ProtectedText protectedText,
            String originalName,
            boolean english) {
        if (translated == null) return null;

        /*
         * 이름은 <b>모르는 낱말이 남아 있어도</b> 내보낸다.
         *
         * 예전에는 "잠근 뒤 한글이 하나라도 남으면 통째로 포기" 였다. 정확했지만 1047곳 중
         * 177곳만 번역되는 원인이었다 — 와릿이즌·메디큐브처럼 공식 일본어 표기가 없는 개별
         * 브랜드가 수백 개인데, 그건 용어집으로 도달할 수 없다.
         *
         * 브랜드 이름을 가타카나로 옮기는 것은 일본에서 외국 브랜드를 다루는 표준이라, 뜻을
         * 지어내는 것과는 종류가 다른 위험이다. 대신 나가는 값을 기계로 검사한다
         * ({@link #looksUnsafeJapanese}) — 중국어로 나오거나 없는 숫자를 지어내면 버린다.
         *
         * <b>장소는 이 완화를 적용하지 않는다.</b> 아래 restoreLocation 이 여전히 "한글이 남으면
         * 버린다" 를 지킨다. 이름이 어색한 것은 읽는 사람이 알아채지만, 장소가 틀리면 그 사람을
         * 다른 동네로 보낸다 — 실제로 남대문이 남산(南山)으로 나온 적이 있다.
         */
        if (!english && looksUnsafeJapanese(translated, originalName)) return null;

        return english
                ? protectedText.restoreEnglish(translated)
                : protectedText.restoreJapanese(translated);
    }

    private String restoreLocation(
            String translated,
            PopupTranslationGlossary.ProtectedText protectedText,
            boolean english) {
        if (translated == null || protectedText.hasUnprotectedHangul()) return null;
        return english
                ? protectedText.restoreEnglish(translated)
                : protectedText.restoreJapanese(translated);
    }

    /**
     * 한 칸을 꺼내 쓸 만한지 본다.
     *
     * <p>원문과 같은 값은 버린다 — 번역하지 못했다는 뜻이고, 저장해 두면 화면이 "번역이 있다"고 판단해 원문 병기를 건너뛴다. 한글이 남아 있는 것도 버린다(영어
     * 칸에 한글이 섞이면 옮기다 만 것이다).
     */
    private String clean(JsonNode node, String field, String original) {
        JsonNode value = node.path(field);
        if (value.isNull() || value.isMissingNode()) return null;
        String text = value.asText("").trim();
        if (text.isBlank() || text.equalsIgnoreCase("null")) return null;
        if (original != null && text.equals(original.trim())) return null;
        if (HANGUL.matcher(text).find()) return null;
        return text.length() > 250 ? null : text;
    }

    private static final java.util.regex.Pattern HANGUL = java.util.regex.Pattern.compile("[가-힣]");

    private static final java.util.regex.Pattern KANA =
            java.util.regex.Pattern.compile("[ぁ-んァ-ヶー]");

    private static final java.util.regex.Pattern KANJI = java.util.regex.Pattern.compile("[一-龯]");

    private static final java.util.regex.Pattern DIGITS = java.util.regex.Pattern.compile("\\d+");

    /** 용어집이 씌운 보호 토큰. {@code PopupTranslationGlossary} 와 같은 모양이어야 한다. */
    private static final java.util.regex.Pattern PROTECTION_TOKEN =
            java.util.regex.Pattern.compile(
                    "ZXQTERM\\d+QXZ", java.util.regex.Pattern.CASE_INSENSITIVE);

    /** 한자만 이 길이 이상 이어지면 일본어 문장으로 보기 어렵다. 짧은 것(銀魂·原神)은 정상이다. */
    private static final int CHINESE_SUSPICION_LENGTH = 4;

    /**
     * 일본어 결과를 <b>내보내면 안 되는지</b> 기계로 판정한다.
     *
     * <p>모르는 브랜드를 가타카나로 옮기게 열면서 함께 넣은 방어선이다. 음역 실패와 뜻 지어내기는 다른 종류다 — 브랜드를 가타카나로 옮기는 것은 일본에서 외국 브랜드를
     * 다루는 표준이지만, 없는 뜻이나 없는 정보를 만드는 것은 막아야 한다.
     *
     * <p><b>모델이 스스로 쓴 부분만 본다.</b> 용어집이 복원할 자리는 보호 토큰이라 여기서 지운다 — 그 자리는 이미 검증된 공식 표기이므로 검사할 이유가 없다.
     * 이 구분이 없으면 {@code 外見至上主義}(외모지상주의의 정답)처럼 <b>맞는 번역이 중국어로 오인</b>된다. 한글 원문에는 한자가 없으니 "원문에 한자가 있었나"
     * 로는 가릴 수 없다.
     *
     * <p>거르는 것은 둘이다.
     *
     * <ul>
     *   <li><b>모델이 쓴 부분이 가나 없는 한자 덩어리</b> — 중국어일 수 있다. 운영에서 남대문잡채호떡이 {@code 南山拌菜熱米糕} 로 나왔다.
     *   <li><b>원문에 없던 숫자</b> — 없는 층수("1F")를 지어낸 적이 있다. 사람이 그 층으로 간다.
     * </ul>
     *
     * <p>여기서 못 잡는 것도 있다. 그럴듯하게 생긴 오역은 사람이 봐야 한다({@code scripts/review-translations.mjs}). 이 검사는
     * <b>확실히 이상한 것</b>만 막는다.
     *
     * @param translated 모델 응답 원문(보호 토큰이 아직 들어 있는 상태)
     */
    static boolean looksUnsafeJapanese(String translated, String source) {
        if (translated == null || translated.isBlank()) return false;
        String original = source == null ? "" : source;

        // 보호 토큰 자리는 검증된 공식 표기가 들어올 곳이다. 모델이 쓴 부분만 남긴다.
        String modelWords = PROTECTION_TOKEN.matcher(translated).replaceAll(" ").trim();
        if (modelWords.isBlank()) return false;

        boolean kanjiOnly =
                KANJI.matcher(modelWords).find()
                        && !KANA.matcher(modelWords).find()
                        && modelWords.length() >= CHINESE_SUSPICION_LENGTH;
        if (kanjiOnly) return true;

        java.util.Set<String> sourceNumbers = new java.util.HashSet<>();
        java.util.regex.Matcher inSource = DIGITS.matcher(original);
        while (inSource.find()) sourceNumbers.add(inSource.group());

        java.util.regex.Matcher inResult = DIGITS.matcher(modelWords);
        while (inResult.find()) {
            if (!sourceNumbers.contains(inResult.group())) return true;
        }
        return false;
    }

    private void recordTokens(TokenUsage tokens) {
        if (tokens == null) {
            usageTracker.recordResponse(LlmUsageTracker.Role.CRAWLER, null, null);
            return;
        }
        usageTracker.recordResponse(
                LlmUsageTracker.Role.CRAWLER, tokens.inputTokenCount(), tokens.outputTokenCount());
    }

    /** 프롬프트에 넣기 전 줄바꿈을 없앤다 — 항목 구분이 깨지면 LLM 이 다른 팝업으로 읽는다. */
    private String safe(String value) {
        if (value == null) return "";
        return value.replaceAll("\\s+", " ").trim();
    }

    /**
     * 번역 결과를 엔티티에 반영한다.
     *
     * <p>{@code translatedAt} 은 LLM이 해당 id를 정상 응답한 경우에만 찍는다. 확신이 없어 비운 응답은 완료로 기록하되, 호출 실패·깨진
     * JSON·응답 누락은 다음 회차에서 다시 시도해야 한다.
     */
    public boolean apply(PopupStore popup, Translated t) {
        if (t == null) return false;
        boolean changed = false;
        if (isBlank(popup.getNameEn()) && t.nameEn() != null) {
            popup.setNameEn(t.nameEn());
            changed = true;
        }
        if (isBlank(popup.getNameJa()) && t.nameJa() != null) {
            popup.setNameJa(t.nameJa());
            changed = true;
        }
        if (isBlank(popup.getLocationEn()) && t.locationEn() != null) {
            popup.setLocationEn(t.locationEn());
            changed = true;
        }
        if (isBlank(popup.getLocationJa()) && t.locationJa() != null) {
            popup.setLocationJa(t.locationJa());
            changed = true;
        }
        popup.setTranslatedAt(LocalDateTime.now());
        return changed;
    }

    /** 번역 결과를 목록 전체에 반영하고, 실제로 채워진 건수를 돌려준다. */
    public int applyAll(List<PopupStore> popups, Map<Long, Translated> translations) {
        int filled = 0;
        List<PopupStore> touched = new ArrayList<>();
        for (PopupStore p : popups) {
            if (!translations.containsKey(p.getId())) continue;
            Translated t = translations.get(p.getId());
            boolean changed = apply(p, t);
            touched.add(p);
            if (changed) filled++;
        }
        log.info("[PopupTranslation] {}건 시도 · {}건 번역됨", touched.size(), filled);
        return filled;
    }

    private record ProtectedPopup(
            PopupStore popup,
            PopupTranslationGlossary.ProtectedText name,
            PopupTranslationGlossary.ProtectedText location) {}

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
