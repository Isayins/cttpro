package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("forum_board_owner_applications")
public class ForumBoardOwnerApplication {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long boardId;

    private Long applicantId;

    private String reason;

    private String status;

    private Long reviewedBy;

    private String reviewNote;

    private Date reviewedAt;

    private Date createTime;

    private Date updateTime;
}
