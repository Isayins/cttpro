package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("replies")
public class Reply {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long postId;

    private String content;

    private Long userId;

    private String author;

    private Date createTime;

    private Date updateTime;
}
