package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("forum_boards")
public class ForumBoard {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String description;

    private String avatarUrl;

    private Long ownerUserId;

    private String levelTitleConfig;

    private Integer sortOrder;

    private Boolean active;

    private Date createTime;

    private Date updateTime;
}
