package com.example.popspotbackend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * 아임포트(PortOne) REST API 직접 호출.
 *
 * 흐름:
 *   1) getToken()  → access_token 발급 (POST /users/getToken)
 *   2) findPaymentByImpUid(impUid) → 실제 결제 정보 조회 (GET /payments/{imp_uid})
 *   3) cancelPayment(impUid, reason, amount) → 위변조 의심 시 자동 환불
 *
 * 직접 호출하는 이유: jitpack 의존성 없이 가벼운 RestTemplate 호출만으로 충분.
 */
@Slf4j
@Service
public class IamportService {

    private static final String BASE = "https://api.iamport.kr";

    @Value("${iamport.api-key:}")
    private String apiKey;

    @Value("${iamport.api-secret:}")
    private String apiSecret;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    @PostConstruct
    void check() {
        if (apiKey.isBlank() || apiSecret.isBlank()) {
            log.warn("⚠️ IAMPORT_API_KEY / IAMPORT_API_SECRET 미설정 — 결제 검증이 비활성화됩니다. " +
                     "운영 배포 전 반드시 설정하세요.");
        }
    }

    /** 결제 검증이 가능한 환경인지 (키 존재 여부) */
    public boolean isConfigured() {
        return !apiKey.isBlank() && !apiSecret.isBlank();
    }

    /** access_token 발급 */
    public String getAccessToken() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, String> body = Map.of(
                "imp_key", apiKey,
                "imp_secret", apiSecret
        );

        ResponseEntity<String> resp = restTemplate.exchange(
                BASE + "/users/getToken",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class
        );

        try {
            JsonNode root = mapper.readTree(resp.getBody());
            int code = root.path("code").asInt(-1);
            if (code != 0) {
                throw new IllegalStateException("Iamport getToken 실패: " + root.path("message").asText());
            }
            return root.path("response").path("access_token").asText();
        } catch (Exception e) {
            throw new IllegalStateException("Iamport getToken 응답 파싱 실패", e);
        }
    }

    /** imp_uid 로 실제 결제 정보 조회 — 위변조 방어의 핵심 */
    public PaymentInfo findPaymentByImpUid(String impUid) {
        String token = getAccessToken();
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", token);

        ResponseEntity<String> resp = restTemplate.exchange(
                BASE + "/payments/" + impUid,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        try {
            JsonNode root = mapper.readTree(resp.getBody());
            int code = root.path("code").asInt(-1);
            if (code != 0) {
                throw new IllegalStateException("Iamport findPayment 실패: " + root.path("message").asText());
            }
            JsonNode r = root.path("response");
            return new PaymentInfo(
                    r.path("imp_uid").asText(),
                    r.path("merchant_uid").asText(),
                    r.path("status").asText(),
                    r.path("amount").asInt(),
                    r.path("buyer_email").asText(""),
                    r.path("paid_at").asLong(0)
            );
        } catch (Exception e) {
            throw new IllegalStateException("Iamport findPayment 응답 파싱 실패", e);
        }
    }

    /** 위변조 의심 시 즉시 환불 */
    public void cancelPayment(String impUid, String reason, int amount) {
        String token = getAccessToken();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", token);

        Map<String, Object> body = Map.of(
                "imp_uid", impUid,
                "reason", reason == null ? "auto-cancel" : reason,
                "amount", amount,
                "checksum", amount
        );

        try {
            ResponseEntity<String> resp = restTemplate.exchange(
                    BASE + "/payments/cancel",
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    String.class
            );
            log.warn("🔁 Iamport 결제 취소 결과 status={} body={}", resp.getStatusCode(), resp.getBody());
        } catch (Exception e) {
            log.error("Iamport 결제 취소 실패 impUid={}: {}", impUid, e.getMessage());
        }
    }

    public record PaymentInfo(String impUid, String merchantUid, String status, int amount,
                              String buyerEmail, long paidAtSec) { }
}
