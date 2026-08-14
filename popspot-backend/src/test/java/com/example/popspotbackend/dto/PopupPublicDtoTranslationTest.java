package com.example.popspotbackend.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.entity.PopupStore;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PopupPublicDtoTranslationTest {

    @Test
    @DisplayName("공개 목록과 상세 DTO가 원문과 영어·일본어 표시명을 함께 보낸다")
    void mapsDisplayTranslationsWithoutReplacingOriginal() {
        PopupStore popup = new PopupStore();
        popup.setName("진격의 거인 팝업스토어");
        popup.setNameEn("Attack on Titan Pop-up Store");
        popup.setNameJa("進撃の巨人 ポップアップストア");
        popup.setLocation("더현대 서울 B1");
        popup.setLocationEn("The Hyundai Seoul B1");
        popup.setLocationJa("ザ・ヒュンダイ・ソウル 地下1階");

        PopupPublicListDto list = PopupPublicListDto.fromEntity(popup);
        PopupPublicDetailDto detail = PopupPublicDetailDto.fromEntity(popup);

        assertThat(list.getName()).isEqualTo("진격의 거인 팝업스토어");
        assertThat(list.getNameEn()).isEqualTo("Attack on Titan Pop-up Store");
        assertThat(list.getNameJa()).isEqualTo("進撃の巨人 ポップアップストア");
        assertThat(list.getLocationEn()).isEqualTo("The Hyundai Seoul B1");
        assertThat(list.getLocationJa()).isEqualTo("ザ・ヒュンダイ・ソウル 地下1階");

        assertThat(detail.getName()).isEqualTo(list.getName());
        assertThat(detail.getNameEn()).isEqualTo(list.getNameEn());
        assertThat(detail.getNameJa()).isEqualTo(list.getNameJa());
        assertThat(detail.getLocationEn()).isEqualTo(list.getLocationEn());
        assertThat(detail.getLocationJa()).isEqualTo(list.getLocationJa());
    }

    @Test
    @DisplayName("공개 상세는 자동수집 원문의 마지막 확인 시각만 보내고 내부 이력은 노출하지 않는다")
    void mapsPublicInformationCheckedAtOnlyForCrawledPopup() {
        PopupStore crawled = new PopupStore();
        crawled.setSourceType("CRAWLED");
        crawled.setCrawledAt(LocalDateTime.of(2026, 8, 1, 4, 0));
        crawled.setLastSeenAt(LocalDateTime.of(2026, 8, 14, 16, 0));

        PopupStore manual = new PopupStore();
        manual.setSourceType("MANUAL");
        manual.setLastSeenAt(LocalDateTime.of(2026, 8, 14, 16, 0));

        assertThat(PopupPublicDetailDto.fromEntity(crawled).getInformationCheckedAt())
                .isEqualTo(LocalDateTime.of(2026, 8, 14, 16, 0));
        assertThat(PopupPublicDetailDto.fromEntity(manual).getInformationCheckedAt()).isNull();
    }
}
