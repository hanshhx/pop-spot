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
    private final ObjectMapper objectMapper = new ObjectMapper();

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
     * @return 팝업 id → 번역. 확신이 없거나 실패한 건은 들어 있지 않다.
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
        CrawlerLlm.Selection selection = crawlerLlm.select();

        // 클라우드 한도는 크롤과 공유한다. 번역이 한도를 다 써서 정작 수집이 막히면 안 되므로,
        // 소진 상태면 조용히 포기한다(예외를 던지지 않는다 — 위 주석의 '있으면 좋은 것' 원칙).
        if (!selection.local()
                && usageTracker.isDailyQuotaExhausted(LlmUsageTracker.Role.CRAWLER)) {
            log.info("[PopupTranslation] 클라우드 일일 한도 소진 — 이번 배치는 건너뜁니다");
            return Map.of();
        }

        String prompt = buildPrompt(batch);
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

        return parse(response.content().text(), batch);
    }

    /**
     * 프롬프트.
     *
     * <p>지시가 긴 이유는 <b>측정에서 드러난 실패를 하나씩 막기 위해서</b>다. 음역으로 흐르는 것, 공식 행사명을 무시하고 조합하는 것, 고유명을 업종명으로 풀어
     * 버리는 것("한복상점" → "Hanbok Shop" 은 서울에 수백 개 있는 업태명이 된다) 이 실제로 나왔다.
     */
    private String buildPrompt(List<PopupStore> batch) {
        StringBuilder items = new StringBuilder();
        for (PopupStore p : batch) {
            items.append("- id: ").append(p.getId()).append('\n');
            items.append("  name: ").append(safe(p.getName())).append('\n');
            if (p.getLocation() != null && !p.getLocation().isBlank()) {
                items.append("  location: ").append(safe(p.getLocation())).append('\n');
            }
        }

        return """
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

        # 반드시 지킬 것
        1. 확신이 없으면 그 칸을 null 로 둬라. 빈 값은 한국어 원문으로 표시되므로 안전하다.
           틀린 이름을 자신 있게 쓰면 관광객이 엉뚱한 곳으로 간다.
        2. 지어내지 마라. 모르는 소상공인 브랜드는 로마자 표기로 두되, 그것도 애매하면 null.
        3. 고유명사를 업종 일반명사로 풀지 마라.
           "한복상점" -> "Hanbok Shop" (X) — 서울에 수백 개 있는 업태명이 되어 특정이 안 된다.
        4. 공식 행사명이 따로 있으면 그것을 써라. 단어를 임의로 조합하지 마라.
        5. location 은 대부분 번지가 아니라 장소 이름이다. 층수는 그대로 옮긴다(지하 1층 -> B1 / 地下1階).

        # 출력
        JSON 배열만. 설명·코드펜스 없이.
        [{"id":123,"nameEn":"...","nameJa":"...","locationEn":"...","locationJa":"..."}]
        확신 없는 칸은 null. 항목을 빠뜨리지 말고 입력 순서대로.

        # 입력
        %s
        """
                .formatted(items.toString().trim());
    }

    private Map<Long, Translated> parse(String raw, List<PopupStore> batch) {
        Map<Long, PopupStore> byId = new HashMap<>();
        for (PopupStore p : batch) {
            byId.put(p.getId(), p);
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
            PopupStore source = byId.get(id);
            if (source == null) continue; // 입력에 없던 id 를 지어낸 경우

            Translated t =
                    new Translated(
                            clean(node, "nameEn", source.getName()),
                            clean(node, "nameJa", source.getName()),
                            clean(node, "locationEn", source.getLocation()),
                            clean(node, "locationJa", source.getLocation()));
            if (!t.isEmpty()) {
                out.put(id, t);
            }
        }
        return out;
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
     * <p>{@code translatedAt} 은 <b>결과와 무관하게</b> 찍는다. 확신이 없어 비워 둔 행과 아직 안 해 본 행을 구분하지 않으면, 백필이 같은 행을
     * 영원히 다시 시도한다.
     */
    public void apply(PopupStore popup, Translated t) {
        if (t != null) {
            if (t.nameEn() != null) popup.setNameEn(t.nameEn());
            if (t.nameJa() != null) popup.setNameJa(t.nameJa());
            if (t.locationEn() != null) popup.setLocationEn(t.locationEn());
            if (t.locationJa() != null) popup.setLocationJa(t.locationJa());
        }
        popup.setTranslatedAt(LocalDateTime.now());
    }

    /** 번역 결과를 목록 전체에 반영하고, 실제로 채워진 건수를 돌려준다. */
    public int applyAll(List<PopupStore> popups, Map<Long, Translated> translations) {
        int filled = 0;
        List<PopupStore> touched = new ArrayList<>();
        for (PopupStore p : popups) {
            Translated t = translations.get(p.getId());
            apply(p, t);
            touched.add(p);
            if (t != null) filled++;
        }
        log.info("[PopupTranslation] {}건 시도 · {}건 번역됨", touched.size(), filled);
        return filled;
    }
}
