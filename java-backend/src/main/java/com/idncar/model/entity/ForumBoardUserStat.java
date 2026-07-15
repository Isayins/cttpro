package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("forum_board_user_stats")
public class ForumBoardUserStat {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long boardId;

    private Long userId;

    private Integer experience;

    private Integer level;

    private Integer consecutiveSignInDays;

    private Date lastSignInAt;

    private Date createTime;

    private Date updateTime;
}
