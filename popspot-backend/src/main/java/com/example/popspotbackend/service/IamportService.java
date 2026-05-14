package com.example.popspotbackend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * 아임포트(PortOne) REST API 클라이언트.
 *
 * <p>흐름: {@link #getAccessToken()} → {@link #findPaymentByImpUid(String)} 로 실제 결제 정보를 가져오고, 위변조가
 * 의심되면 {@link #cancelPayment(String, String, int)} 로 즉시 환불한다. jitpack 의존성 없이 RestTemplate 호출만으로 충분해
 * 직접 호출 방식을 택했다.
 */
@Slf4j
@Service
public class IamportService {

    private static final String BASE_URL = "https://api.iamport.kr";
    private static final String GET_TOKEN_PATH = "/users/getToken";
    private static final String PAYMENTS_PATH = "/payments/";
    private static final String CANCEL_PATH = "/payments/cancel";

    private static final String FIELD_CODE = "code";
    private static final String FIELD_MESSAGE = "message";
    private static final String FIELD_RESPONSE = "response";
    private static final int SUCCESS_CODE = 0;

    private static final String DEFAULT_CANCEL_REASON = "auto-cancel";

    @Value("${iamport.api-key:}")
    private String apiKey;

    @Value("${iamport.api-secret:}")
    private String apiSecret;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    @PostConstruct
    void check() {
        if (apiKey.isBlank() || apiSecret.isBlank()) {
            log.warn(
                    "IAMPORT_API_KEY / IAMPORT_API_SECRET 미설정 — 결제 검증 비활성화. "
                            + "운영 배포 전 반드시 설정하세요.");
        }
    }

    public boolean isConfigured() {
        return !apiKey.isBlank() && !apiSecret.isBlank();
    }

    /* ============================== 토큰 / 조회 / 취소 ============================== */

    public String getAccessToken() {
        Map<String, String> body = Map.of("imp_key", apiKey, "imp_secret", apiSecret);
        ResponseEntity<String> resp =
                restTemplate.exchange(
                        BASE_URL + GET_TOKEN_PATH,
                        HttpMethod.POST,
                        new HttpEntity<>(body, jsonHeaders()),
                        String.class);
        try {
            JsonNode root = parseSuccessResponse(resp.getBody(), "getToken");
            return root.path("access_token").asText();
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Iamport getToken 응답 파싱 실패", e);
        }
    }

    /** {@code imp_uid} 로 실제 결제 정보를 조회해 클라이언트가 보낸 값과 대조한다 (위변조 방어 핵심). */
    public PaymentInfo findPaymentByImpUid(String impUid) {
        ResponseEntity<String> resp =
                restTemplate.exchange(
                        BASE_URL + PAYMENTS_PATH + impUid,
                        HttpMethod.GET,
                        new HttpEntity<>(authHeaders(getAccessToken())),
                        String.class);
        try {
            JsonNode r = parseSuccessResponse(resp.getBody(), "findPayment");
            return new PaymentInfo(
                    r.path("imp_uid").asText(),
                    r.path("merchant_uid").asText(),
                    r.path("status").asText(),
                    r.path("amount").asInt(),
                    r.path("buyer_email").asText(""),
                    r.path("paid_at").asLong(0));
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Iamport findPayment 응답 파싱 실패", e);
        }
    }

    public void cancelPayment(String impUid, String reason, int amount) {
        HttpHeaders headers = jsonHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, getAccessToken());

        Map<String, Object> body =
                Map.of(
                        "imp_uid", impUid,
                        "reason", reason == null ? DEFAULT_CANCEL_REASON : reason,
                        "amount", amount,
                        "checksum", amount);
        try {
            ResponseEntity<String> resp =
                    restTemplate.exchange(
                            BASE_URL + CANCEL_PATH,
                            HttpMethod.POST,
                            new HttpEntity<>(body, headers),
                            String.class);
            log.warn("Iamport 결제 취소 결과 status={} body={}", resp.getStatusCode(), resp.getBody());
        } catch (Exception e) {
            log.error("Iamport 결제 취소 실패 impUid={}: {}", impUid, e.getMessage());
        }
    }

    /* ============================== 내부 헬퍼 ============================== */

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, token);
        return headers;
    }

    private JsonNode parseSuccessResponse(String body, String operation) throws Exception {
        JsonNode root = mapper.readTree(body);
        int code = root.path(FIELD_CODE).asInt(-1);
        if (code != SUCCESS_CODE) {
            throw new IllegalStateException(
                    "Iamport " + operation + " 실패: " + root.path(FIELD_MESSAGE).asText());
        }
        return root.path(FIELD_RESPONSE);
    }

    public record PaymentInfo(
            String impUid,
            String merchantUid,
            String status,
            int amount,
            String buyerEmail,
            long paidAtSec) {}
}
