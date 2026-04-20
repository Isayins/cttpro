package com.idncar.model.dto;

import com.idncar.model.entity.SiteNotice;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class SiteNoticeDto {

    private Long id;
    private String title;
    private String content;
    private Boolean published;
    private Integer sortOrder;
    private String createTime;
    private String updateTime;

    public static SiteNoticeDto fromEntity(SiteNotice entity) {
        SiteNoticeDto dto = new SiteNoticeDto();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        dto.setContent(entity.getContent());
        dto.setPublished(Boolean.TRUE.equals(entity.getPublished()));
        dto.setSortOrder(entity.getSortOrder());
        dto.setCreateTime(formatDate(entity.getCreateTime()));
        dto.setUpdateTime(formatDate(entity.getUpdateTime()));
        return dto;
    }

    private static String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
