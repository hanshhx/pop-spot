package com.example.popspotbackend.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * v2.19 — Caffeine in-memory 캐시 설정.
 *
 * <p>자주 호출되는 GET 응답을 5분 캐싱해 DB 부하 ↓. 인증 / 검수 / 실시간 데이터는 캐싱 안 함 —
 * stale 응답이 사용자 경험에 직격타가 되므로.
 *
 * <p>캐시 이름 / 정책:
 *
 * <ul>
 *   <li>{@code popups-visible} — 지도용 노출 가능 팝업 (5분, 최대 1)
 *   <li>{@code popups-hot} — 인기 팝업 (5분, 최대 1)
 *   <li>{@code popup-detail} — 팝업 상세 (10분, 최대 200)
 *   <li>{@code mypage} — 사용자 마이페이지 요약 (1분, 최대 500) — 짧은 TTL 로 stale 위험 ↓
 * </ul>
 *
 * <p>운영 환경에서 캐시가 부담스러우면 {@code spring.cache.type=none} 으로 비활성 가능.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String CACHE_POPUPS_VISIBLE = "popups-visible";
    public static final String CACHE_POPUPS_HOT = "popups-hot";
    public static final String CACHE_POPUP_DETAIL = "popup-detail";
    public static final String CACHE_MYPAGE = "mypage";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.setCacheNames(
                List.of(
                        CACHE_POPUPS_VISIBLE,
                        CACHE_POPUPS_HOT,
                        CACHE_POPUP_DETAIL,
                        CACHE_MYPAGE));
        manager.setCaffeine(
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(500)
                        .recordStats());
        return manager;
    }
}
