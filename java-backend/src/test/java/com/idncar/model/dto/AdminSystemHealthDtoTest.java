package com.idncar.model.dto;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AdminSystemHealthDtoTest {

    @Test
    void statusUsesWorstItemAndScorePenalizesWarningsAndErrors() {
        AdminSystemHealthDto health = AdminSystemHealthDto.of(List.of(
                item("mail", "OK"),
                item("payment", "WARNING"),
                item("delivery", "ERROR")
        ));

        assertThat(health.getStatus()).isEqualTo("ERROR");
        assertThat(health.getScore()).isEqualTo(74);
        assertThat(health.getCheckedAt()).isNotBlank();
    }

    @Test
    void allOkItemsKeepFullScore() {
        AdminSystemHealthDto health = AdminSystemHealthDto.of(List.of(
                item("mail", "OK"),
                item("downloads", "OK")
        ));

        assertThat(health.getStatus()).isEqualTo("OK");
        assertThat(health.getScore()).isEqualTo(100);
    }

    private AdminSystemHealthDto.Item item(String key, String status) {
        return new AdminSystemHealthDto.Item(
                key,
                key,
                status,
                "summary",
                "detail",
                "action",
                "overview"
        );
    }
}
