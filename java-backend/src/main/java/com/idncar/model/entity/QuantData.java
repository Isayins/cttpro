package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("quant_data")
public class QuantData {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String symbol;

    private Date date;

    private BigDecimal open;

    private BigDecimal high;

    private BigDecimal low;

    private BigDecimal close;

    private Long volume;

    private BigDecimal amount;

    private BigDecimal indicator1;

    private BigDecimal indicator2;

    private Date createTime;

    private Date updateTime;
}
