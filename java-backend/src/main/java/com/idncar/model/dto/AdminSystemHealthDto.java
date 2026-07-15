package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

@Data
@AllArgsConstructor
public class AdminSystemHealthDto {

    private String status;
    private Integer score;
    private String checkedAt;
    private List<Item> items;

    public static AdminSystemHealthDto of(List<Item> items) {
        String status = items.stream().anyMatch(item -> "ERROR".equals(item.getStatus()))
                ? "ERROR"
                : items.stream().anyMatch(item -> "WARNING".equals(item.getStatus())) ? "WARNING" : "OK";
        int score = 100;
        for (Item item : items) {
            if ("ERROR".equals(item.getStatus())) {
                score -= 18;
            } else if ("WARNING".equals(item.getStatus())) {
                score -= 8;
            }
        }
        return new AdminSystemHealthDto(
                status,
                Math.max(0, score),
                new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()),
                items
        );
    }

    @Data
    @AllArgsConstructor
    public static class Item {
        private String key;
        private String title;
        private String status;
        private String summary;
        private String detail;
        private String actionLabel;
        private String targetSection;
    }
}
