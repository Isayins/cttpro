package com.idncar.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.idncar.model.entity.DownloadResource;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface DownloadResourceMapper extends BaseMapper<DownloadResource> {

    @Update("""
            UPDATE download_resources
            SET download_count = COALESCE(download_count, 0) + 1
            WHERE id = #{id}
            """)
    int incrementDownloadCount(@Param("id") Long id);
}
