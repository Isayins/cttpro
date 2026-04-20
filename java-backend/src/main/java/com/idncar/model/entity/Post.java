package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("posts")
public class Post {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String content;

    private String category;

    private String tags;

    private Boolean pinned;

    private Integer favoriteCount;

    private Long userId;

    private String author;

    private Date createTime;

    private Date updateTime;

    private Integer viewCount;

    private Integer likeCount;
}
