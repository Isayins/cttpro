package com.idncar.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.idncar.model.entity.Post;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface PostMapper extends BaseMapper<Post> {

    int incrementViewCount(@Param("id") Long id);

    int incrementLikeCount(@Param("id") Long id, @Param("delta") int delta);

    int incrementFavoriteCount(@Param("id") Long id, @Param("delta") int delta);

    List<Post> selectByIdsInOrder(@Param("ids") List<Long> ids);

    Page<Post> selectFavoritePage(Page<Post> page,
                                  @Param("userId") Long userId,
                                  @Param("keyword") String keyword,
                                  @Param("categoryAliases") List<String> categoryAliases,
                                  @Param("mineOnly") boolean mineOnly);
}
