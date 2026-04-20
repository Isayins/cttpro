package com.idncar.model.dto;

import lombok.Data;

@Data
public class RecentVisitDto {

    private String path;
    private String title;
    private String visitorId;
    private String nickname;
    private String deviceType;
    private String source;
    private String createTime;
}
