package com.idncar.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.idncar.model.entity.ProductCouponCode;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ProductCouponCodeMapper extends BaseMapper<ProductCouponCode> {

    @Update("""
            UPDATE product_coupon_codes
            SET status = 'LOCKED',
                locked_by = #{userId},
                lock_order_no = #{outTradeNo},
                locked_at = NOW()
            WHERE id = #{id}
              AND status = 'ACTIVE'
              AND (expires_at IS NULL OR expires_at > NOW())
            """)
    int lockForOrder(@Param("id") Long id, @Param("userId") Long userId, @Param("outTradeNo") String outTradeNo);

    @Update("""
            UPDATE product_coupon_codes
            SET status = 'USED',
                used_by = #{userId},
                used_order_no = #{outTradeNo},
                used_at = NOW(),
                locked_by = NULL,
                lock_order_no = NULL,
                locked_at = NULL
            WHERE id = #{id}
              AND status = 'LOCKED'
              AND lock_order_no = #{outTradeNo}
            """)
    int markUsedForOrder(@Param("id") Long id, @Param("userId") Long userId, @Param("outTradeNo") String outTradeNo);

    @Update("""
            UPDATE product_coupon_codes
            SET status = 'ACTIVE',
                locked_by = NULL,
                lock_order_no = NULL,
                locked_at = NULL
            WHERE lock_order_no = #{outTradeNo}
              AND status = 'LOCKED'
            """)
    int releaseByOrderNo(@Param("outTradeNo") String outTradeNo);

    @Update("""
            UPDATE product_coupon_codes coupon
            JOIN payment_orders order_item ON coupon.lock_order_no = order_item.out_trade_no
            SET coupon.status = 'ACTIVE',
                coupon.locked_by = NULL,
                coupon.lock_order_no = NULL,
                coupon.locked_at = NULL
            WHERE coupon.status = 'LOCKED'
              AND (
                    order_item.status IN ('TRADE_CLOSED', 'FAILED')
                    OR (
                        order_item.status IN ('CREATED', 'WAIT_BUYER_PAY')
                        AND order_item.expire_time IS NOT NULL
                        AND order_item.expire_time <= NOW()
                    )
              )
            """)
    int releaseExpiredOrderLocks();
}
