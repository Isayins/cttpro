package com.idncar.service.impl;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.idncar.mapper.PostMapper;
import com.idncar.mapper.ReplyMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.PostDto;
import com.idncar.model.dto.ReplyDto;
import com.idncar.model.dto.CreatePostRequest;
import com.idncar.model.dto.CreateReplyRequest;
import com.idncar.model.entity.Post;
import com.idncar.model.entity.Reply;
import com.idncar.model.entity.User;
import com.idncar.service.ForumService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.ArrayList;

@Service
public class ForumServiceImpl implements ForumService {

    @Autowired
    private PostMapper postMapper;

    @Autowired
    private ReplyMapper replyMapper;

    @Autowired
    private UserMapper userMapper;

    @Override
    public PostDto createPost(CreatePostRequest request, Long userId) {
        User user = userMapper.selectById(userId);
        Post post = new Post();
        post.setTitle(request.getTitle());
        post.setContent(request.getContent());
        post.setUserId(userId);
        post.setAuthor(user.getNickname());
        post.setCreateTime(new Date());
        post.setUpdateTime(new Date());
        post.setViewCount(0);
        post.setLikeCount(0);
        postMapper.insert(post);
        return PostDto.fromEntity(post);
    }

    @Override
    public List<PostDto> getPosts(int page, int size) {
        Page<Post> postPage = new Page<>(page, size);
        List<Post> posts = postMapper.selectPage(postPage, null).getRecords();
        List<PostDto> postDtos = new ArrayList<>();
        for (Post post : posts) {
            postDtos.add(PostDto.fromEntity(post));
        }
        return postDtos;
    }

    @Override
    public PostDto getPostById(Long id) {
        Post post = postMapper.selectById(id);
        post.setViewCount(post.getViewCount() + 1);
        postMapper.updateById(post);
        return PostDto.fromEntity(post);
    }

    @Override
    public PostDto updatePost(Long id, CreatePostRequest request, Long userId) {
        Post post = postMapper.selectById(id);
        if (!post.getUserId().equals(userId)) {
            throw new RuntimeException("无权限修改此帖子");
        }
        post.setTitle(request.getTitle());
        post.setContent(request.getContent());
        post.setUpdateTime(new Date());
        postMapper.updateById(post);
        return PostDto.fromEntity(post);
    }

    @Override
    public void deletePost(Long id, Long userId) {
        Post post = postMapper.selectById(id);
        if (!post.getUserId().equals(userId)) {
            throw new RuntimeException("无权限删除此帖子");
        }
        postMapper.deleteById(id);
    }

    @Override
    public ReplyDto createReply(Long postId, CreateReplyRequest request, Long userId) {
        User user = userMapper.selectById(userId);
        Reply reply = new Reply();
        reply.setPostId(postId);
        reply.setContent(request.getContent());
        reply.setUserId(userId);
        reply.setAuthor(user.getNickname());
        reply.setCreateTime(new Date());
        reply.setUpdateTime(new Date());
        replyMapper.insert(reply);
        return ReplyDto.fromEntity(reply);
    }

    @Override
    public List<ReplyDto> getReplies(Long postId, int page, int size) {
        Page<Reply> replyPage = new Page<>(page, size);
        List<Reply> replies = replyMapper.selectByPostId(postId, replyPage);
        List<ReplyDto> replyDtos = new ArrayList<>();
        for (Reply reply : replies) {
            replyDtos.add(ReplyDto.fromEntity(reply));
        }
        return replyDtos;
    }

    @Override
    public void likePost(Long postId) {
        Post post = postMapper.selectById(postId);
        post.setLikeCount(post.getLikeCount() + 1);
        postMapper.updateById(post);
    }
}
