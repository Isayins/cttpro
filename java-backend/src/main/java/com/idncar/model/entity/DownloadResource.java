package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("download_resources")
public class DownloadResource {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;
    private String version;
    private String changelog;
    private String url;
    private String icon;
    private Boolean locked;
    private String downloadPasswordHash;
    private String category;
    private String fileSize;
    private String checksumSha256;
    private Integer downloadCount;
    private Integer sortOrder;
    private Date createTime;
    private Date updateTime;
}
