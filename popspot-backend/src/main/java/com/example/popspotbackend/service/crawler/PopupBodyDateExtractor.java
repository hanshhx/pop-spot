package com.example.popspotbackend.service.crawler;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 원본 글 <b>본문</b>에서 팝업 운영 기간을 뽑는다.
 *
 * <p>v2.46 — 검색 요약문(snippet)에는 기간이 없는데 본문에는 있는 경우를 줍기 위한 것이다. 실측:
 * 날짜 없이 저장된 팝업의 원본 19건을 열어 보니 <b>5건(26%)</b>에 기간 표현이 있었다. 나머지는 기간이
 * 포스터 <b>이미지</b>에 박혀 있어 글자로는 읽을 수 없다 — 26% 가 사실상 이 방식의 천장이다.
 *
 * <p><b>LLM 을 쓰지 않는다.</b> 본문은 5,000~25,000자라 통째로 넘기면 토큰이 감당이 안 되고, 실측에서
 * 정규식만으로 "7월 15일~8월 9일" · "운영기간 2026년 7월 19일" 같은 표현이 정확히 잡혔다. 비용 0 으로
 * 같은 결과를 얻는다.
 *
 * <p><b>애매하면 포기한다.</b> v2.45 이후 날짜 없는 팝업은 화면에 아예 안 나오므로, 틀린 날짜를 넣으면
 * <b>닫힌 팝업이 열린 것처럼 보인다.</b> "못 채움" 보다 "잘못 채움" 이 훨씬 나쁘다. 그래서 기간으로
 * 읽히는 형태만 받고, 조금이라도 이상하면 {@link Optional#empty()} 를 돌려준다.
 */
@Slf4j
@Component
public class PopupBodyDateExtractor {

    /** 뽑아낸 기간. 종료일만 있는 경우도 있어 start 는 null 일 수 있다. */
    public record Period(LocalDate start, LocalDate end) {}

    /**
     * 시작~종료가 이어진 형태. "7월 15일~8월 9일" · "7/10-8/06" · "6.22 ~ 11.1" · "2026.07.22~2026.08.03"
     *
     * <p>그룹: 1=시작年(선택) 2=시작月 3=시작日 4=종료年(선택) 5=종료月 6=종료日
     *
     * <p><b>연도를 반드시 붙잡는다.</b> 처음에는 {@code (?:\d{4}...)?} 로 건너뛰기만 했는데, 그러면
     * "2019년 3월 1일" 을 3월 1일로만 읽고 기준 연도(올해)를 붙여 <b>2026-03-01 로 저장</b>했다.
     * 본문에 적힌 연도를 버리고 다른 값을 만들어 넣는 셈이라, 이 클래스가 피하려는 바로 그 사고다.
     */
    /**
     * 날짜 뒤에 흔히 붙는 요일 괄호 — "7월 19일(일요일)" · "8월 4일(화)".
     *
     * <p>이걸 빠뜨렸다가 실측에서 걸렸다. "운영기간 2026년 7월 19일(일요일) - 8월 4일(화요일)" 이
     * 통째로 안 잡혀, 명백히 기간이 적힌 글을 "기간 없음" 으로 판정했다. 한국 행사 안내에서 아주 흔한
     * 표기라 이 하나로 회수율이 눈에 띄게 갈린다.
     */
    private static final String DOW = "(?:\\s*\\([^)]{1,8}\\))?";

    private static final Pattern RANGE =
            Pattern.compile(
                    "(?:(\\d{4})\\s*[.년]\\s*)?(\\d{1,2})\\s*[월./]\\s*(\\d{1,2})\\s*일?"
                            + DOW
                            + "\\s*[~\\-–—]\\s*"
                            + "(?:(\\d{4})\\s*[.년]\\s*)?(\\d{1,2})\\s*[월./]\\s*(\\d{1,2})\\s*일?"
                            + DOW);

    /** "7월 22일부터 8월 3일까지". 그룹: 1=시작年(선택) 2=시작月 3=시작日 4=종료月(선택) 5=종료日 */
    private static final Pattern FROM_TO =
            Pattern.compile(
                    "(?:(\\d{4})\\s*[.년]\\s*)?(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일"
                            + DOW
                            + "\\s*부터"
                            + "[\\s\\S]{0,16}?"
                            + "(?:(\\d{1,2})\\s*월\\s*)?(\\d{1,2})\\s*일"
                            + DOW
                            + "\\s*까지");

    /** "8월 3일까지" — 종료일만. 그룹: 1=年(선택) 2=月 3=日 */
    private static final Pattern UNTIL_ONLY =
            Pattern.compile(
                    "(?:(\\d{4})\\s*[.년]\\s*)?(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일"
                            + DOW
                            + "\\s*까지");

    /** 기간을 가리키는 말머리가 가까이 있으면 신뢰도가 높다 — 후보가 여럿일 때 우선한다. */
    private static final Pattern PERIOD_LABEL =
            Pattern.compile("(운영\\s*기간|팝업\\s*기간|진행\\s*기간|행사\\s*기간|기간)");

    /** 말머리 뒤 이 범위 안의 후보를 "말머리가 붙은 것" 으로 본다. */
    private static final int LABEL_WINDOW = 60;

    /** 팝업 기간이 이보다 길면 기간 표기가 아니라고 본다(연혁·통계 같은 다른 숫자를 잡은 것). */
    private static final int MAX_SPAN_DAYS = 200;

    /** 기준일로부터 이만큼 넘게 지난 종료일은 이 팝업 것이 아니라고 본다. */
    private static final int MAX_PAST_DAYS = 400;

    /** 기준일로부터 이만큼 넘게 앞선 시작일도 마찬가지. */
    private static final int MAX_FUTURE_DAYS = 400;

    /**
     * 본문에서 기간을 찾는다. 없거나 믿을 수 없으면 empty.
     *
     * @param body 태그를 걷어낸 본문 텍스트
     * @param reference 연도를 채울 기준일(글 작성일 → 없으면 수집일). 한국 글은 연도를 자주 생략한다.
     */
    public Optional<Period> extract(String body, LocalDate reference) {
        if (body == null || body.isBlank() || reference == null) return Optional.empty();

        // 말머리("운영기간") 근처를 먼저 본다. 블로그 본문에는 무관한 날짜가 널려 있어
        // (사이드바 공지·광고·글 작성 시각) 아무 날짜나 집으면 엉뚱한 값이 들어간다.
        Optional<Period> labeled = searchNearLabel(body, reference);
        if (labeled.isPresent()) return labeled;

        return searchWhole(body, reference);
    }

    private Optional<Period> searchNearLabel(String body, LocalDate reference) {
        Matcher label = PERIOD_LABEL.matcher(body);
        while (label.find()) {
            int from = label.end();
            int to = Math.min(body.length(), from + LABEL_WINDOW);
            Optional<Period> found = searchWhole(body.substring(from, to), reference);
            if (found.isPresent()) return found;
        }
        return Optional.empty();
    }

    /**
     * 기간 후보를 찾는다.
     *
     * <p><b>범위 표현이 잡혔는데 검증에 걸리면 거기서 끝낸다.</b> 아래 "종료일만" 규칙으로 흘려보내면
     * "2월 30일부터 3월 5일까지" 같은 잘못된 표기에서 뒤쪽 절반만 건져 올린다 — 앞이 틀린 문장의 뒤를
     * 믿을 근거가 없다.
     */
    private Optional<Period> searchWhole(String text, LocalDate reference) {
        Matcher range = RANGE.matcher(text);
        if (range.find()) {
            return build(
                    year(range.group(1)),
                    num(range.group(2)),
                    num(range.group(3)),
                    year(range.group(4)),
                    num(range.group(5)),
                    num(range.group(6)),
                    reference);
        }

        Matcher fromTo = FROM_TO.matcher(text);
        if (fromTo.find()) {
            Integer startYear = year(fromTo.group(1));
            int startMonth = num(fromTo.group(2));
            // 종료일에 월이 생략되면 시작일의 월을 이어받는다("7월 8일부터 25일까지").
            int endMonth = fromTo.group(4) == null ? startMonth : num(fromTo.group(4));
            return build(
                    startYear,
                    startMonth,
                    num(fromTo.group(3)),
                    null,
                    endMonth,
                    num(fromTo.group(5)),
                    reference);
        }

        Matcher until = UNTIL_ONLY.matcher(text);
        if (until.find()) {
            LocalDate end =
                    resolve(year(until.group(1)), num(until.group(2)), num(until.group(3)), reference);
            if (end != null && plausibleEnd(end, reference)) {
                return Optional.of(new Period(null, end));
            }
        }
        return Optional.empty();
    }

    private Optional<Period> build(
            Integer sy, int sm, int sd, Integer ey, int em, int ed, LocalDate reference) {
        LocalDate start = resolve(sy, sm, sd, reference);
        // 종료일에 연도가 없으면 시작 연도를 이어받는다("2026년 12월 20일 ~ 1월 5일" 은 아래에서 보정).
        LocalDate end = resolve(ey != null ? ey : sy, em, ed, reference);
        if (start == null || end == null) return Optional.empty();

        // 종료가 시작보다 앞이면 해가 바뀐 것으로 본다("12월 20일~1월 5일").
        if (end.isBefore(start)) end = end.plusYears(1);

        if (end.isBefore(start)) return Optional.empty();
        if (start.plusDays(MAX_SPAN_DAYS).isBefore(end)) return Optional.empty();
        if (!plausibleEnd(end, reference)) return Optional.empty();
        if (start.isAfter(reference.plusDays(MAX_FUTURE_DAYS))) return Optional.empty();

        return Optional.of(new Period(start, end));
    }

    private boolean plausibleEnd(LocalDate end, LocalDate reference) {
        return !end.isBefore(reference.minusDays(MAX_PAST_DAYS))
                && !end.isAfter(reference.plusDays(MAX_FUTURE_DAYS));
    }

    /**
     * 월·일에 연도를 채운다.
     *
     * <p>본문에 연도가 <b>적혀 있으면 그대로 쓴다</b> — 우리가 고쳐 넣지 않는다. 그 값이 오래된 행사라면
     * 뒤의 타당성 검사에서 걸러진다("2019년 3월" → 기준일에서 400일 밖 → 폐기).
     *
     * <p>연도가 없을 때만 기준일 기준으로 올해·내년 중 가까운 쪽을 고른다(12월 글의 "1월 5일" 대응).
     *
     * <p>실재하지 않는 날짜(2월 30일)는 null — 조용히 보정하지 않는다.
     */
    private LocalDate resolve(Integer explicitYear, int month, int day, LocalDate reference) {
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        if (explicitYear != null) return safeDate(explicitYear, month, day);

        for (int year : List.of(reference.getYear(), reference.getYear() + 1)) {
            LocalDate d = safeDate(year, month, day);
            if (d == null) continue;
            // 기준일에서 너무 멀지 않은 해를 고른다.
            if (!d.isBefore(reference.minusDays(MAX_PAST_DAYS))
                    && !d.isAfter(reference.plusDays(MAX_FUTURE_DAYS))) {
                return d;
            }
        }
        return null;
    }

    /** 4자리 연도 그룹 → Integer. 없으면 null(= 기준일로 추정하라는 뜻). */
    private Integer year(String s) {
        if (s == null || s.isBlank()) return null;
        int v = num(s);
        return v >= 1900 && v <= 2200 ? v : null;
    }

    private LocalDate safeDate(int year, int month, int day) {
        try {
            return LocalDate.of(year, month, day);
        } catch (Exception e) {
            return null;
        }
    }

    private int num(String s) {
        try {
            return Integer.parseInt(s.trim());
        } catch (Exception e) {
            return -1;
        }
    }
}
