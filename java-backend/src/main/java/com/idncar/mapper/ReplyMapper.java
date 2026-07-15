package com.idncar.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.idncar.model.entity.Reply;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface ReplyMapper extends BaseMapper<Reply> {

    List<Reply> selectByPostId(@Param("postId") Long postId, @Param("page") Page<Reply> page);

    List<Map<String, Object>> selectReplyCountByPostIds(@Param("postIds") List<Long> postIds);
}
