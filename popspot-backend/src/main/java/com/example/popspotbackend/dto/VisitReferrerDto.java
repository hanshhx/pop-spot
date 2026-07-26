package com.example.popspotbackend.dto;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 어드민 유입 경로 집계 응답 한 줄.
 *
 * <p>{@code source} 는 사람이 읽을 출처 이름(네이버·구글 등), {@code host} 는 그 그룹을 대표하는(가장 많이 들어온) 도메인이다. 전체 URL 은
 * 저장하지 않는 방침이라 도메인만 다룬다.
 */
public record VisitReferrerDto(String source, String host, long visits) {

    /** www.google.com · google.co.kr · news.google.com 처럼 국가 도메인이 갈리는 구글 계열을 한 그룹으로 본다. */
    private static final Pattern GOOGLE_HOST =
            Pattern.compile("^(.+\\.)?google(\\.[a-z]{2,3}){1,2}$");

    /** 사이트 내 이동. 유입 경로가 아니므로 집계에서 뺀다. */
    private static final String INTERNAL = "internal";

    /**
     * (referrer_host, 방문수) 원본 행들을 사람이 읽을 출처로 묶어 visits 내림차순으로 반환한다. 같은 그룹의 여러 호스트는
     * 합산한다(search.naver.com + m.search.naver.com → 네이버).
     */
    public static List<VisitReferrerDto> from(List<Object[]> rows) {
        Map<String, VisitReferrerDto> grouped = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String host = row[0] == null ? null : row[0].toString().toLowerCase();
            if (host == null || host.isBlank() || INTERNAL.equals(host)) continue;
            long visits = row[1] instanceof Number n ? n.longValue() : 0L;

            String source = classify(host);
            VisitReferrerDto prev = grouped.get(source);
            if (prev == null) {
                grouped.put(source, new VisitReferrerDto(source, host, visits));
            } else {
                // 대표 host 는 그룹 안에서 방문수가 많은 쪽을 남긴다.
                String repHost = visits > prev.visits() ? host : prev.host();
                grouped.put(source, new VisitReferrerDto(source, repHost, prev.visits() + visits));
            }
        }
        return grouped.values().stream()
                .sorted(Comparator.comparingLong(VisitReferrerDto::visits).reversed())
                .toList();
    }

    /** 도메인 → 출처 이름. 모르는 도메인은 묶지 않고 host 를 그대로 보여준다(어디서 오는지 눈으로 확인해야 하므로). */
    private static String classify(String host) {
        if ("direct".equals(host)) return "직접 방문";
        if (under(host, "naver.com")) return "네이버";
        if (GOOGLE_HOST.matcher(host).matches()) return "구글";
        if (under(host, "daum.net") || under(host, "kakao.com")) return "다음/카카오";
        if (under(host, "instagram.com")) return "인스타그램";
        if (under(host, "youtube.com") || under(host, "youtu.be")) return "유튜브";
        return host;
    }

    /** host 가 domain 자신이거나 그 하위 도메인인지. endsWith 만 쓰면 fakenaver.com 도 걸리므로 점을 붙여 본다. */
    private static boolean under(String host, String domain) {
        return host.equals(domain) || host.endsWith("." + domain);
    }
}
