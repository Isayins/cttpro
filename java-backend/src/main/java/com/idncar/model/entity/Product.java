package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("products")
public class Product {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;
    private String subtitle;
    private String description;
    private String imageUrl;
    private BigDecimal price;
    private Integer stock;
    private Integer salesCount;
    private String deliveryType;
    private String deliveryInstructions;
    private String status;
    private Integer sortOrder;
    private Date createTime;
    private Date updateTime;
}
