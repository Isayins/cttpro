package com.idncar.model.dto;

import com.idncar.model.entity.Post;
import com.idncar.model.entity.PostReport;
import com.idncar.model.entity.User;
import lombok.Data;

import java.text.SimpleDateFormat;

@Data
public class AdminPostReportDto {

    private Long id;
    private Long postId;
    private String postTitle;
    private Long reporterId;
    private String reporterName;
    private String reason;
    private String detail;
    private String status;
    private String reviewNote;
    private Long reviewedBy;
    private String reviewedByName;
    private String createTime;
    private String updateTime;
    private String reviewedAt;

    public static AdminPostReportDto fromEntity(PostReport entity, Post post, User reporter, User reviewer) {
        AdminPostReportDto dto = new AdminPostReportDto();
        dto.setId(entity.getId());
        dto.setPostId(entity.getPostId());
        dto.setPostTitle(post == null ? "帖子已删除" : post.getTitle());
        dto.setReporterId(entity.getReporterId());
        dto.setReporterName(reporter == null ? "用户#" + entity.getReporterId() : reporter.getNickname());
        dto.setReason(entity.getReason());
        dto.setDetail(entity.getDetail());
        dto.setStatus(entity.getStatus());
        dto.setReviewNote(entity.getReviewNote());
        dto.setReviewedBy(entity.getReviewedBy());
        dto.setReviewedByName(reviewer == null || entity.getReviewedBy() == null ? null : reviewer.getNickname());
        dto.setCreateTime(formatDate(entity.getCreateTime()));
        dto.setUpdateTime(formatDate(entity.getUpdateTime()));
        dto.setReviewedAt(formatDate(entity.getReviewedAt()));
        return dto;
    }

    private static String formatDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
