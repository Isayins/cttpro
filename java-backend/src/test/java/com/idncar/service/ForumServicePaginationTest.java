package com.idncar.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.idncar.mapper.PostMapper;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.PostDto;
import com.idncar.model.entity.Post;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ForumServicePaginationTest {

    @Test
    void getPostsReturnsDatabaseTotalAndNormalizedPageBounds() {
        ForumService service = new ForumService();
        PostMapper postMapper = mock(PostMapper.class);
        ReflectionTestUtils.setField(service, "postMapper", postMapper);
        when(postMapper.selectPage(any(Page.class), any())).thenAnswer(invocation -> {
            Page<Post> page = invocation.getArgument(0);
            page.setRecords(List.of());
            page.setTotal(42);
            return page;
        });

        PageResultDto<PostDto> result = service.getPosts(-1, 1_000, null, null, false, false, null);

        assertThat(result.getRecords()).isEmpty();
        assertThat(result.getTotal()).isEqualTo(42);
        assertThat(result.getPage()).isEqualTo(1);
        assertThat(result.getSize()).isEqualTo(100);
    }
}
