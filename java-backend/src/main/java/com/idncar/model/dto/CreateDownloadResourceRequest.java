package com.idncar.model.dto;

import lombok.Data;

@Data
public class CreateDownloadResourceRequest {

    private String title;
    private String version;
    private String changelog;
    private String url;
    private String icon;
    private Boolean locked;
    private String category;
    private String fileSize;
    private String checksumSha256;
    private Integer sortOrder;
}
