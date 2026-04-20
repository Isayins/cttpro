package com.idncar.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.idncar.model.entity.Reply;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ReplyMapper extends BaseMapper<Reply> {

    List<Reply> selectByPostId(@Param("postId") Long postId, @Param("page") Page<Reply> page);
}
