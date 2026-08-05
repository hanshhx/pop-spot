package com.example.popspotbackend.dto;

import java.util.List;

/**
 * C-4 퍼널 — 들어온 사람이 어디까지 가고 어디서 멈추나.
 *
 * <p><b>각 칸은 사람 수다. 횟수가 아니다.</b> 퍼널이 묻는 것은 "100명 중 몇 명이 다음으로 갔나" 라,
 * 한 사람이 팝업 스무 개를 연 것과 스무 명이 하나씩 연 것이 같아 보이면 안 된다.
 *
 * @param steps 첫 칸부터 순서대로
 * @param since 집계 시작 시각(ISO)
 * @param note 읽는 사람이 반드시 알아야 할 한계. 없으면 빈 문자열
 */
public record FunnelDto(List<Step> steps, String since, String note) {

    /**
     * @param key 화면이 아이콘·색을 고를 때 쓰는 안정된 이름
     * @param label 사람이 읽는 이름
     * @param visitors 이 단계를 밟은 사람 수
     * @param ofFirst 첫 칸 대비 비율(%)
     * @param ofPrev 바로 앞 칸 대비 비율(%). 첫 칸은 100
     * @param collectedSince 이 단계의 수집이 시작된 날. 그전 기간은 0 으로 보인다. 처음부터 모은
     *     단계는 빈 문자열
     */
    public record Step(
            String key,
            String label,
            long visitors,
            double ofFirst,
            double ofPrev,
            String collectedSince) {}

    /**
     * 사람 수 목록에서 비율을 채워 만든다.
     *
     * <p><b>비율을 화면에 미루지 않는다.</b> 분모가 0 인 자리가 칸마다 있어서, 화면에서 나누면 그
     * 자리를 화면 수만큼 다시 만들게 된다. 방문이 없는 날 관리자 표에 {@code NaN} 이 뜨면 "집계가
     * 고장났다" 로 읽힌다.
     *
     * <p><b>퍼널이 아래로 갈수록 줄어든다고 가정하지 않는다.</b> 상세를 연 사람보다 찜한 사람이 많을
     * 수는 없어야 정상이지만, 수집 시작일이 단계마다 다르거나 링크를 직접 받아 들어온 경우 뒤 칸이
     * 앞 칸보다 클 수 있다. 그때 100% 를 넘겨 그대로 보여 준다 — 억지로 자르면 <b>이상하다는 신호</b>
     * 까지 지워진다.
     */
    public static FunnelDto of(List<Raw> raws, String since, String note) {
        long first = raws.isEmpty() ? 0 : raws.get(0).visitors();
        List<Step> steps =
                java.util.stream.IntStream.range(0, raws.size())
                        .mapToObj(
                                i -> {
                                    Raw r = raws.get(i);
                                    long prev = i == 0 ? r.visitors() : raws.get(i - 1).visitors();
                                    return new Step(
                                            r.key(),
                                            r.label(),
                                            r.visitors(),
                                            percent(r.visitors(), first),
                                            i == 0 ? 100.0 : percent(r.visitors(), prev),
                                            r.collectedSince());
                                })
                        .toList();
        return new FunnelDto(steps, since, note == null ? "" : note);
    }

    /** 비율을 계산하기 전의 한 칸. */
    public record Raw(String key, String label, long visitors, String collectedSince) {}

    /** 소수 첫째 자리까지. 분모가 0 이면 0 — 화면에 NaN 이 나가지 않게. */
    private static double percent(long value, long total) {
        if (total <= 0) return 0;
        return Math.round((value * 1000.0 / total)) / 10.0;
    }
}
