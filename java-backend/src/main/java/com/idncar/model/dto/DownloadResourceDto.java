package com.idncar.model.dto;

import com.idncar.model.entity.DownloadResource;
import lombok.Data;

import java.text.SimpleDateFormat;

@Data
public class DownloadResourceDto {

    private Long id;
    private String title;
    private String version;
    private String changelog;
    private String url;
    private String icon;
    private Boolean locked;
    private Boolean passwordProtected;
    private String category;
    private String fileSize;
    private String checksumSha256;
    private Integer downloadCount;
    private Integer sortOrder;
    private String createTime;
    private String updateTime;

    public static DownloadResourceDto fromEntity(DownloadResource entity) {
        DownloadResourceDto dto = new DownloadResourceDto();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        dto.setVersion(entity.getVersion());
        dto.setChangelog(entity.getChangelog());
        dto.setUrl(entity.getUrl());
        dto.setIcon(entity.getIcon());
        dto.setLocked(Boolean.TRUE.equals(entity.getLocked()));
        dto.setPasswordProtected(entity.getDownloadPasswordHash() != null && !entity.getDownloadPasswordHash().isBlank());
        dto.setCategory(entity.getCategory());
        dto.setFileSize(entity.getFileSize());
        dto.setChecksumSha256(entity.getChecksumSha256());
        dto.setDownloadCount(entity.getDownloadCount());
        dto.setSortOrder(entity.getSortOrder());
        dto.setCreateTime(formatDate(entity.getCreateTime()));
        dto.setUpdateTime(formatDate(entity.getUpdateTime()));
        return dto;
    }

    public static DownloadResourceDto fromPublicEntity(DownloadResource entity) {
        DownloadResourceDto dto = fromEntity(entity);
        if (Boolean.TRUE.equals(entity.getLocked())
                || (entity.getDownloadPasswordHash() != null && !entity.getDownloadPasswordHash().isBlank())) {
            dto.setUrl("download-resource:" + entity.getId());
        }
        return dto;
    }

    private static String formatDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
