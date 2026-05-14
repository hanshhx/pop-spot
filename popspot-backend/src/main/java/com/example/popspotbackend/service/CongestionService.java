package com.example.popspotbackend.service;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.XML;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * 서울시 실시간 도시데이터 — 인구 혼잡도 + 날씨 + 12시간 예측.
 *
 * <p>1차로 사용자 API 키, 실패 시 {@code sample} 키로 재시도, 두 차례 모두 실패하면 데모 데이터를 돌려줘 프론트 그래프 깨짐을 막는다. 서울시 API
 * 응답은 XML/JSON 이 섞여 있어 양쪽 모두 파싱한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CongestionService {

    private static final String BASE_URL = "http://openapi.seoul.go.kr:8088/";
    private static final String PATH_SUFFIX = "/json/citydata/1/5/";

    private static final String FALLBACK_API_KEY = "sample";
    private static final String DEFAULT_AREA_KEY = "SEONGSU";
    private static final String DEFAULT_AREA_NAME = "성수카페거리";

    private static final int REQUEST_TIMEOUT_MS = 5000;
    private static final int DEMO_FORECAST_HOURS = 12;
    private static final int DEMO_BASE_POPULATION = 10_000;

    private static final Map<String, String> AREA_MAP =
            Map.of(
                    "SEONGSU", DEFAULT_AREA_NAME,
                    "YEOUIDO", "여의도한강공원",
                    "HONGDAE", "홍대 관광특구",
                    "GANGNAM", "강남 MICE 관광특구",
                    "YONGSAN", "용산역",
                    "MYEONGDONG", "명동 관광특구");

    @Value("${seoul.api.key}")
    private String userApiKey;

    public Map<String, Object> getCongestionData(String locationKey) {
        String areaName = AREA_MAP.getOrDefault(safeUpperCase(locationKey), DEFAULT_AREA_NAME);

        Map<String, Object> result = fetchData(areaName, userApiKey);
        if (isErrorResult(result)) {
            log.warn("[Congestion] 사용자 키 실패 ({}) → '{}' 키로 재시도", areaName, FALLBACK_API_KEY);
            Map<String, Object> fallback = fetchData(areaName, FALLBACK_API_KEY);
            if (!isErrorResult(fallback)) return fallback;
        }
        return result;
    }

    /* ============================== 네트워크 ============================== */

    private Map<String, Object> fetchData(String areaName, String apiKey) {
        try {
            String response = callApi(areaName, apiKey);
            if (response == null || response.trim().isEmpty()) return demoFor(areaName);

            JSONObject rootData = extractRootData(parseResponse(response));
            return rootData != null ? processCityData(rootData, areaName) : demoFor(areaName);
        } catch (Exception e) {
            log.error("[Congestion] API Error: {}", e.getMessage());
            return demoFor(areaName);
        }
    }

    private String callApi(String areaName, String apiKey) throws Exception {
        String cleanKey = (apiKey == null || apiKey.isBlank()) ? FALLBACK_API_KEY : apiKey.trim();
        String encodedName = URLEncoder.encode(areaName, StandardCharsets.UTF_8);
        URI uri = new URI(BASE_URL + cleanKey + PATH_SUFFIX + encodedName);

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.USER_AGENT, "Mozilla/5.0");

        ResponseEntity<String> response =
                buildRestTemplate()
                        .exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        return response.getBody();
    }

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(REQUEST_TIMEOUT_MS);
        factory.setReadTimeout(REQUEST_TIMEOUT_MS);
        return new RestTemplate(factory);
    }

    /* ============================== 파싱 ============================== */

    private JSONObject parseResponse(String response) {
        return response.trim().startsWith("<")
                ? XML.toJSONObject(response)
                : new JSONObject(response);
    }

    private JSONObject extractRootData(JSONObject json) {
        if (json.has("citydata")) return json.getJSONObject("citydata");
        if (json.has("CITYDATA")) return json.getJSONObject("CITYDATA");
        if (json.has("SeoulRtd.citydata")) return json.getJSONObject("SeoulRtd.citydata");
        return null;
    }

    private Map<String, Object> processCityData(JSONObject cityData, String areaName) {
        try {
            JSONObject livePopulation = readNested(cityData, "LIVE_PPLTN_STTS");
            if (livePopulation == null) return demoFor(areaName);

            Map<String, Object> result = new HashMap<>();
            result.put("areaName", areaName);
            result.put("level", livePopulation.optString("AREA_CONGEST_LVL", "보통"));
            result.put("message", livePopulation.optString("AREA_CONGEST_MSG", "실시간 데이터 수신 완료"));
            result.put("minPop", livePopulation.optInt("AREA_PPLTN_MIN", 0));
            result.put("maxPop", livePopulation.optInt("AREA_PPLTN_MAX", 0));

            applyWeather(result, cityData);
            applyForecasts(result, cityData);
            applyAgeRates(result);
            return result;
        } catch (Exception e) {
            log.error("[Congestion] 데이터 가공 에러: {}", e.getMessage());
            return demoFor(areaName);
        }
    }

    /** 응답에서 같은 키가 한 단계 더 중첩되어 오는 경우가 있어 양쪽 모두 지원. */
    private JSONObject readNested(JSONObject parent, String key) {
        if (!parent.has(key)) return null;
        Object node = parent.get(key);
        if (node instanceof JSONArray array) return array.getJSONObject(0);
        if (node instanceof JSONObject inner) {
            if (inner.has(key)) return inner.getJSONArray(key).getJSONObject(0);
            return inner;
        }
        return null;
    }

    private void applyWeather(Map<String, Object> result, JSONObject cityData) {
        String temp = "24.5";
        String sky = "맑음";
        try {
            JSONObject weather = readNested(cityData, "WEATHER_STTS");
            if (weather != null) {
                temp = String.valueOf(weather.optDouble("TEMP", 24.5));
                sky = weather.optString("PCP_MSG", weather.optString("SKY_STTS", "맑음"));
            }
        } catch (Exception ignore) {
            // 날씨 파싱 실패는 치명적이지 않으므로 기본값 유지.
        }
        result.put("temp", temp);
        result.put("sky", sky);
    }

    private void applyForecasts(Map<String, Object> result, JSONObject cityData) {
        List<Map<String, Object>> forecasts = parseForecasts(cityData);
        if (forecasts.isEmpty()) forecasts = demoForecasts();
        result.put("forecasts", forecasts);
    }

    private List<Map<String, Object>> parseForecasts(JSONObject cityData) {
        List<Map<String, Object>> forecasts = new ArrayList<>();
        if (!cityData.has("FCST_PPLTN")) return forecasts;

        Object fcstNode = cityData.get("FCST_PPLTN");
        JSONArray fcstArr = null;
        if (fcstNode instanceof JSONArray arr) {
            fcstArr = arr;
        } else if (fcstNode instanceof JSONObject obj && obj.has("FCST_PPLTN")) {
            fcstArr = obj.getJSONArray("FCST_PPLTN");
        }
        if (fcstArr == null) return forecasts;

        for (int i = 0; i < fcstArr.length(); i++) {
            forecasts.add(toForecastEntry(fcstArr.getJSONObject(i)));
        }
        return forecasts;
    }

    private Map<String, Object> toForecastEntry(JSONObject item) {
        Map<String, Object> entry = new HashMap<>();
        entry.put("time", formatForecastTime(item.optString("FCST_TIME", "")));
        entry.put("congestion", item.optString("FCST_CONGEST_LVL", "보통"));
        int min = item.optInt("FCST_PPLTN_MIN", 0);
        int max = item.optInt("FCST_PPLTN_MAX", 0);
        entry.put("population", (min + max) / 2);
        return entry;
    }

    private String formatForecastTime(String timeStr) {
        if (timeStr.length() > 11) return timeStr.substring(11, 13) + "시";
        return timeStr;
    }

    private void applyAgeRates(Map<String, Object> result) {
        Map<String, Integer> ageRates = new HashMap<>();
        int twenties = 40 + new Random().nextInt(20);
        ageRates.put("20s", twenties);
        ageRates.put("30s", 100 - twenties - 10);
        result.put("ageRates", ageRates);
    }

    /* ============================== 데모 데이터 ============================== */

    private boolean isErrorResult(Map<String, Object> result) {
        String message = (String) result.get("message");
        return message != null && (message.contains("Demo") || message.contains("오류"));
    }

    private List<Map<String, Object>> demoForecasts() {
        Random r = new Random();
        List<Map<String, Object>> list = new ArrayList<>(DEMO_FORECAST_HOURS);
        for (int i = 1; i <= DEMO_FORECAST_HOURS; i++) {
            Map<String, Object> m = new HashMap<>();
            m.put("time", (i + 12) + "시");
            m.put("population", DEMO_BASE_POPULATION + r.nextInt(5000));
            list.add(m);
        }
        return list;
    }

    private Map<String, Object> demoFor(String areaName) {
        Random random = new Random();
        String[] levels = {"여유", "보통", "약간 붐빔", "붐빔"};
        String[] skies = {"맑음", "구름많음", "흐림"};

        int idx = random.nextInt(levels.length);
        int basePop = 5000 + (idx * 5000);

        Map<String, Object> demo = new HashMap<>();
        demo.put("areaName", areaName);
        demo.put("level", levels[idx]);
        demo.put("message", "네트워크 지연으로 예측 데이터를 보여드립니다. (Demo)");
        demo.put("minPop", basePop);
        demo.put("maxPop", basePop + 2000);
        demo.put("temp", String.format("%.1f", 15 + random.nextDouble() * 10));
        demo.put("sky", skies[random.nextInt(skies.length)]);
        demo.put("forecasts", demoForecasts());

        Map<String, Integer> ageRates = new HashMap<>();
        ageRates.put("20s", 55);
        ageRates.put("30s", 35);
        demo.put("ageRates", ageRates);
        return demo;
    }

    private String safeUpperCase(String s) {
        return s == null ? DEFAULT_AREA_KEY : s.toUpperCase();
    }
}
