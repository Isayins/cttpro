package com.idncar.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.idncar.model.entity.PaymentOrder;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PaymentOrderMapper extends BaseMapper<PaymentOrder> {

    @Update("""
            UPDATE payment_orders
            SET paid_handled = 1
            WHERE id = #{id}
              AND COALESCE(paid_handled, 0) = 0
            """)
    int markPaidHandledIfNeeded(@Param("id") Long id);
}
