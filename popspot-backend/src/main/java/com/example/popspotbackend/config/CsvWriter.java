package com.example.popspotbackend.config;

import java.util.List;
import java.util.Map;

/**
 * 표 데이터를 CSV 로 만든다.
 *
 * <p>두 가지를 반드시 처리해야 한다. 둘 다 "그냥 쉼표로 이어붙이기" 로는 안 되는 것들이다.
 *
 * <p><b>첫째, 엑셀이 한글을 깨뜨린다.</b> 엑셀은 CSV 를 열 때 UTF-8 이라는 표시(BOM)가 없으면 시스템 기본 인코딩으로 읽는다. 한국어 윈도우에서는 그게
 * UTF-8 이 아니라서 "홍길동" 이 "?쒓만" 처럼 나온다. 파일 앞에 BOM 세 바이트를 붙이면 해결된다 — 이게 없으면 "다운로드는 되는데 열면 글자가 깨진다" 는
 * 신고를 받는다.
 *
 * <p><b>둘째, 값이 수식으로 실행된다.</b> 엑셀은 {@code =}, {@code +}, {@code -}, {@code @} 로 시작하는 칸을 <b>수식</b>으로
 * 해석한다. 방문 경로나 브라우저 정보처럼 우리가 만들지 않은 값이 그대로 들어가면, 그것을 연 사람의 컴퓨터에서 의도치 않은 것이 실행될 수 있다. 앞에 작은따옴표를 붙여
 * 글자로 고정한다.
 */
public final class CsvWriter {

    private CsvWriter() {}

    /** UTF-8 표시(BOM). 엑셀이 한글을 제대로 읽게 하는 유일한 방법이다. */
    public static final String BOM = "﻿";

    /** 엑셀이 수식으로 해석하는 시작 문자들. */
    private static final String FORMULA_STARTERS = "=+-@";

    /**
     * 헤더와 행 목록을 CSV 문자열로.
     *
     * @param headers 첫 줄에 넣을 칸 이름들
     * @param keys 각 행에서 꺼낼 키. {@code headers} 와 순서가 같아야 한다
     * @param rows 데이터
     */
    public static String write(
            List<String> headers, List<String> keys, List<Map<String, Object>> rows) {
        StringBuilder sb = new StringBuilder(BOM);

        sb.append(String.join(",", headers.stream().map(CsvWriter::cell).toList()));
        sb.append("\r\n");

        for (Map<String, Object> row : rows) {
            sb.append(
                    String.join(
                            ",",
                            keys.stream()
                                    .map(k -> cell(row.get(k) == null ? "" : row.get(k).toString()))
                                    .toList()));
            // CRLF 를 쓴다. 엑셀은 LF 만으로도 열지만, 일부 구버전과 다른 표 도구가 한 줄로 붙여
            // 읽는 경우가 있어 표준을 따른다.
            sb.append("\r\n");
        }
        return sb.toString();
    }

    /** 칸 하나 — 수식 실행을 막고 따옴표로 감싼다. */
    static String cell(String raw) {
        String value = raw == null ? "" : raw;

        // 수식으로 해석될 문자로 시작하면 작은따옴표를 앞에 붙여 글자로 고정한다.
        if (!value.isEmpty() && FORMULA_STARTERS.indexOf(value.charAt(0)) >= 0) {
            value = "'" + value;
        }

        // 값 안의 따옴표는 두 개로 바꾼다(CSV 규칙). 그러지 않으면 그 자리에서 칸이 끊겨
        // 뒤의 내용이 다음 칸으로 밀린다.
        return '"' + value.replace("\"", "\"\"") + '"';
    }
}
