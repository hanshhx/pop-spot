package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupWaitReport;
import com.example.popspotbackend.repository.PopupWaitReportRepository;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 팝업 "지금 어때요?" 대기 제보 집계.
 *
 * <p>최근 {@link #WINDOW_HOURS}시간 제보만 유효(오래된 대기 정보는 쓸모없음). 같은 사람은 {@link #COOLDOWN_MINUTES}분에 한 번만
 * 제보할 수 있어 한 명이 여론을 흔들지 못한다.
 */
@Service
@RequiredArgsConstructor
public class PopupWaitService {

    /** 집계 유효 창(시간). 대기 정보는 금방 낡는다. */
    private static final int WINDOW_HOURS = 3;

    /** 같은 사람 재제보 제한(분). */
    private static final int COOLDOWN_MINUTES = 60;

    private static final int LEVEL_MIN = 0;
    private static final int LEVEL_MAX = 2;
    private static final int KEY_MAX_LENGTH = 64;

    private final PopupWaitReportRepository repo;

    /** 최근 집계 결과. 제보가 없으면 null. */
    public record WaitStatus(int level, int count, LocalDateTime updatedAt) {}

    /**
     * 원터치 제보. 쿨다운 중이면 저장하지 않고 false.
     *
     * @param reporterKey 로그인 유저 {@code u:userId} 또는 게스트 {@code g:visitorId}
     */
    @Transactional
    public boolean report(Long popupId, int level, String reporterKey) {
        if (popupId == null || reporterKey == null || reporterKey.isBlank()) return false;

        String key = clamp(reporterKey);
        LocalDateTime cooldownSince = LocalDateTime.now().minusMinutes(COOLDOWN_MINUTES);
        if (repo.countByPopupIdAndReporterKeyAndCreatedAtAfter(popupId, key, cooldownSince) > 0) {
            return false;
        }

        repo.save(
                PopupWaitReport.builder()
                        .popupId(popupId)
                        .waitLevel(clampLevel(level))
                        .reporterKey(key)
                        .build());
        return true;
    }

    /** 최근 {@link #WINDOW_HOURS}시간 제보 평균. 제보 없으면 null. */
    @Transactional(readOnly = true)
    public WaitStatus status(Long popupId) {
        if (popupId == null) return null;
        List<PopupWaitReport> recent =
                repo.findByPopupIdAndCreatedAtAfter(popupId, LocalDateTime.now().minusHours(WINDOW_HOURS));
        if (recent.isEmpty()) return null;

        double avg = recent.stream().mapToInt(PopupWaitReport::getWaitLevel).average().orElse(0);
        LocalDateTime last =
                recent.stream()
                        .map(PopupWaitReport::getCreatedAt)
                        .filter(java.util.Objects::nonNull)
                        .max(Comparator.naturalOrder())
                        .orElse(null);
        return new WaitStatus((int) Math.round(avg), recent.size(), last);
    }

    private static int clampLevel(int level) {
        return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, level));
    }

    private static String clamp(String s) {
        return s.length() > KEY_MAX_LENGTH ? s.substring(0, KEY_MAX_LENGTH) : s;
    }
}
