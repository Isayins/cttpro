package com.idncar.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.idncar.model.entity.Product;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ProductMapper extends BaseMapper<Product> {

    @Update("""
            UPDATE products
            SET sales_count = COALESCE(sales_count, 0) + 1,
                stock = CASE
                    WHEN delivery_type = 'CDK_EMAIL' THEN stock
                    ELSE stock - 1
                END
            WHERE id = #{id}
              AND (delivery_type = 'CDK_EMAIL' OR stock > 0)
            """)
    int markPaid(@Param("id") Long id);
}
