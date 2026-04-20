package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("site_notices")
public class SiteNotice {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;
    private String content;
    private Boolean published;
    private Integer sortOrder;
    private Date createTime;
    private Date updateTime;
}
