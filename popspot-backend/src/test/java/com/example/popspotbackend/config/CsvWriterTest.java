package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * CSV 의 <b>두 가지 고전적 함정</b>을 확인한다.
 *
 * <p>둘 다 "받아서 열어 보기 전까지는 모른다" 는 공통점이 있다. 개발 화면에서는 멀쩡하고, 사장님이 엑셀로 열었을 때 처음 드러난다.
 */
class CsvWriterTest {

    @Test
    @DisplayName("파일이 UTF-8 표시로 시작한다 — 없으면 엑셀에서 한글이 깨진다")
    void startsWithBom() {
        String csv =
                CsvWriter.write(List.of("이름"), List.of("name"), List.of(Map.of("name", "홍길동")));

        assertThat(csv)
                .describedAs("BOM 이 없으면 한국어 윈도우 엑셀이 시스템 인코딩으로 읽어 글자가 깨진다")
                .startsWith(CsvWriter.BOM);
        assertThat(csv).contains("홍길동");
    }

    @Test
    @DisplayName("수식으로 시작하는 값은 글자로 고정한다 — 남의 컴퓨터에서 실행되면 안 된다")
    void neutralizesFormulas() {
        // 방문 경로나 브라우저 정보는 우리가 만든 값이 아니다. 엑셀은 이런 문자로 시작하는 칸을
        // 수식으로 해석하므로, 파일을 연 사람의 컴퓨터에서 의도치 않은 것이 돌 수 있다.
        for (String dangerous : new String[] {"=1+1", "+1", "-1", "@SUM(A1)"}) {
            String csv =
                    CsvWriter.write(List.of("값"), List.of("v"), List.of(Map.of("v", dangerous)));

            assertThat(csv)
                    .describedAs("'%s' 가 수식으로 남았다", dangerous)
                    .contains("\"'" + dangerous + "\"");
        }
    }

    @Test
    @DisplayName("값 안의 따옴표는 두 개로 바꾼다 — 안 그러면 칸이 그 자리에서 끊긴다")
    void escapesQuotes() {
        String csv =
                CsvWriter.write(
                        List.of("값"), List.of("v"), List.of(Map.of("v", "그가 \"안녕\" 이라 했다")));

        assertThat(csv).contains("\"그가 \"\"안녕\"\" 이라 했다\"");
    }

    @Test
    @DisplayName("쉼표와 줄바꿈이 들어 있어도 한 칸으로 유지된다")
    void keepsCommasAndNewlinesInOneCell() {
        String cell = CsvWriter.cell("가, 나\n다");

        assertThat(cell).isEqualTo("\"가, 나\n다\"");
    }

    @Test
    @DisplayName("빈 값과 null 도 칸을 차지한다 — 빠지면 뒤 칸이 앞으로 밀린다")
    void emptyValuesStillOccupyColumns() {
        String csv =
                CsvWriter.write(
                        List.of("가", "나", "다"),
                        List.of("a", "b", "c"),
                        List.of(new java.util.HashMap<>(Map.of("a", "1", "c", "3"))));

        // b 가 없어도 칸은 세 개여야 한다.
        String dataRow = csv.split("\r\n")[1];
        assertThat(dataRow).isEqualTo("\"1\",\"\",\"3\"");
    }
}
