package com.idncar.service;

import com.idncar.model.dto.PostDto;
import com.idncar.model.dto.ReplyDto;
import com.idncar.model.dto.CreatePostRequest;
import com.idncar.model.dto.CreateReplyRequest;

import java.util.List;

public interface ForumService {

    PostDto createPost(CreatePostRequest request, Long userId);

    List<PostDto> getPosts(int page, int size);

    PostDto getPostById(Long id);

    PostDto updatePost(Long id, CreatePostRequest request, Long userId);

    void deletePost(Long id, Long userId);

    ReplyDto createReply(Long postId, CreateReplyRequest request, Long userId);

    List<ReplyDto> getReplies(Long postId, int page, int size);

    void likePost(Long postId);
}
