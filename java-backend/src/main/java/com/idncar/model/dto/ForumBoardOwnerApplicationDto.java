package com.idncar.model.dto;

import com.idncar.model.entity.ForumBoard;
import com.idncar.model.entity.ForumBoardOwnerApplication;
import com.idncar.model.entity.User;
import lombok.Data;

import java.text.SimpleDateFormat;

@Data
public class ForumBoardOwnerApplicationDto {

    private Long id;
    private Long boardId;
    private String boardName;
    private String boardAvatarUrl;
    private Long applicantId;
    private String applicantNickname;
    private String applicantAvatarUrl;
    private String reason;
    private String status;
    private Long reviewedBy;
    private String reviewNote;
    private String reviewedAt;
    private String createTime;
    private String updateTime;

    public static ForumBoardOwnerApplicationDto fromEntity(
            ForumBoardOwnerApplication application,
            ForumBoard board,
            User applicant
    ) {
        ForumBoardOwnerApplicationDto dto = new ForumBoardOwnerApplicationDto();
        dto.setId(application.getId());
        dto.setBoardId(application.getBoardId());
        dto.setBoardName(board == null ? null : board.getName());
        dto.setBoardAvatarUrl(board == null ? null : board.getAvatarUrl());
        dto.setApplicantId(application.getApplicantId());
        dto.setApplicantNickname(applicant == null ? null : applicant.getNickname());
        dto.setApplicantAvatarUrl(applicant == null ? null : applicant.getAvatarUrl());
        dto.setReason(application.getReason());
        dto.setStatus(application.getStatus());
        dto.setReviewedBy(application.getReviewedBy());
        dto.setReviewNote(application.getReviewNote());
        dto.setReviewedAt(formatDate(application.getReviewedAt()));
        dto.setCreateTime(formatDate(application.getCreateTime()));
        dto.setUpdateTime(formatDate(application.getUpdateTime()));
        return dto;
    }

    private static String formatDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
