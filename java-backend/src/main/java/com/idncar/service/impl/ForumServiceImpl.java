package com.idncar.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.idncar.exception.ApiException;
import com.idncar.mapper.PostLikeMapper;
import com.idncar.mapper.PostMapper;
import com.idncar.mapper.PostFavoriteMapper;
import com.idncar.mapper.PostReportMapper;
import com.idncar.mapper.ReplyMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.CreatePostReportRequest;
import com.idncar.model.dto.CreatePostRequest;
import com.idncar.model.dto.CreateReplyRequest;
import com.idncar.model.dto.PostDto;
import com.idncar.model.dto.ReplyDto;
import com.idncar.model.entity.Post;
import com.idncar.model.entity.PostLike;
import com.idncar.model.entity.PostFavorite;
import com.idncar.model.entity.PostReport;
import com.idncar.model.entity.Reply;
import com.idncar.model.entity.User;
import com.idncar.service.ForumService;
import com.idncar.service.NotificationService;
import com.idncar.service.UserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ForumServiceImpl implements ForumService {

    private static final String DEFAULT_CATEGORY = "综合交流";
    private static final int MAX_TAGS = 5;

    @Autowired
    private PostMapper postMapper;

    @Autowired
    private ReplyMapper replyMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PostLikeMapper postLikeMapper;

    @Autowired
    private PostFavoriteMapper postFavoriteMapper;

    @Autowired
    private PostReportMapper postReportMapper;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private NotificationService notificationService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PostDto createPost(CreatePostRequest request, Long userId) {
        User user = userAccessService.requireActiveUser(userId);

        Post post = new Post();
        post.setTitle(requireText(request.getTitle(), "标题不能为空"));
        post.setContent(requireText(request.getContent(), "内容不能为空"));
        post.setCategory(normalizeCategory(request.getCategory()));
        post.setTags(joinTags(request.getTags()));
        post.setUserId(userId);
        post.setAuthor(user.getNickname());
        post.setPinned(false);
        post.setFavoriteCount(0);
        post.setCreateTime(new Date());
        post.setUpdateTime(new Date());
        post.setViewCount(0);
        post.setLikeCount(0);
        postMapper.insert(post);

        return toPostDto(post, userId);
    }

    @Override
    public List<PostDto> getPosts(int page, int size, String keyword, String category, Boolean mineOnly, Boolean favoritesOnly, Long currentUserId) {
        if ((Boolean.TRUE.equals(mineOnly) || Boolean.TRUE.equals(favoritesOnly)) && currentUserId == null) {
            throw ApiException.unauthorized("请先登录后查看个人帖子或收藏");
        }

        Page<Post> postPage = new Page<>(Math.max(page, 1), Math.max(size, 1));
        QueryWrapper<Post> queryWrapper = new QueryWrapper<>();

        String normalizedKeyword = normalizeNullableText(keyword);
        if (normalizedKeyword != null) {
            queryWrapper.and(wrapper -> wrapper
                    .like("title", normalizedKeyword)
                    .or()
                    .like("content", normalizedKeyword)
                    .or()
                    .like("tags", normalizedKeyword));
        }

        String normalizedCategory = normalizeNullableText(category);
        if (normalizedCategory != null && !"全部".equals(normalizedCategory)) {
            queryWrapper.eq("category", normalizedCategory);
        }

        if (Boolean.TRUE.equals(mineOnly)) {
            queryWrapper.eq("user_id", currentUserId);
        }

        if (Boolean.TRUE.equals(favoritesOnly)) {
            List<Long> favoritePostIds = postFavoriteMapper.selectList(new QueryWrapper<PostFavorite>()
                            .eq("user_id", currentUserId)
                            .orderByDesc("create_time"))
                    .stream()
                    .map(PostFavorite::getPostId)
                    .collect(Collectors.toList());
            if (favoritePostIds.isEmpty()) {
                return List.of();
            }
            queryWrapper.in("id", favoritePostIds);
        }

        queryWrapper.orderByDesc("pinned").orderByDesc("create_time");

        List<Post> posts = postMapper.selectPage(postPage, queryWrapper).getRecords();
        return toPostDtos(posts, currentUserId);
    }

    @Override
    public PostDto getPostById(Long id, Long currentUserId) {
        requirePost(id);
        postMapper.incrementViewCount(id);
        return toPostDto(requirePost(id), currentUserId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PostDto updatePost(Long id, CreatePostRequest request, Long userId) {
        Post post = requirePost(id);
        userAccessService.requireActiveUser(userId);

        if (!post.getUserId().equals(userId) && !userAccessService.isAdmin(userId)) {
            throw ApiException.forbidden("无权修改该帖子");
        }

        post.setTitle(requireText(request.getTitle(), "标题不能为空"));
        post.setContent(requireText(request.getContent(), "内容不能为空"));
        post.setCategory(normalizeCategory(request.getCategory()));
        post.setTags(joinTags(request.getTags()));
        post.setUpdateTime(new Date());
        postMapper.updateById(post);
        return toPostDto(postMapper.selectById(id), userId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deletePost(Long id, Long userId) {
        Post post = requirePost(id);
        userAccessService.requireActiveUser(userId);

        if (!post.getUserId().equals(userId) && !userAccessService.isAdmin(userId)) {
            throw ApiException.forbidden("无权删除该帖子");
        }

        postFavoriteMapper.delete(new QueryWrapper<PostFavorite>().eq("post_id", id));
        postMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ReplyDto createReply(Long postId, CreateReplyRequest request, Long userId) {
        requirePost(postId);
        User user = userAccessService.requireActiveUser(userId);

        Reply reply = new Reply();
        reply.setPostId(postId);
        reply.setContent(requireText(request.getContent(), "回复内容不能为空"));
        reply.setUserId(userId);
        reply.setAuthor(user.getNickname());
        reply.setCreateTime(new Date());
        reply.setUpdateTime(new Date());
        replyMapper.insert(reply);

        Post post = requirePost(postId);
        if (!post.getUserId().equals(userId)) {
            notificationService.createNotification(
                    post.getUserId(),
                    "FORUM_REPLY",
                    "你的帖子收到了新回复",
                    user.getNickname() + " 回复了你的帖子《" + limitText(post.getTitle(), 40) + "》",
                    "/forum"
            );
        }

        return toReplyDto(reply);
    }

    @Override
    public List<ReplyDto> getReplies(Long postId, int page, int size) {
        requirePost(postId);
        Page<Reply> replyPage = new Page<>(Math.max(page, 1), Math.max(size, 1));
        List<Reply> replies = replyMapper.selectByPostId(postId, replyPage);
        return replies.stream().map(this::toReplyDto).collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PostDto toggleLikePost(Long postId, Long userId) {
        userAccessService.requireActiveUser(userId);
        Post post = requirePost(postId);

        QueryWrapper<PostLike> queryWrapper = new QueryWrapper<PostLike>()
                .eq("post_id", postId)
                .eq("user_id", userId)
                .last("LIMIT 1");
        PostLike existingLike = postLikeMapper.selectOne(queryWrapper);

        if (existingLike == null) {
            PostLike postLike = new PostLike();
            postLike.setPostId(postId);
            postLike.setUserId(userId);
            postLike.setCreateTime(new Date());
            postLikeMapper.insert(postLike);
            postMapper.incrementLikeCount(postId, 1);

            if (!post.getUserId().equals(userId)) {
                User currentUser = userMapper.selectById(userId);
                String nickname = currentUser == null ? "有用户" : currentUser.getNickname();
                notificationService.createNotification(
                        post.getUserId(),
                        "FORUM_LIKE",
                        "你的帖子收到了新点赞",
                        nickname + " 点赞了你的帖子《" + limitText(post.getTitle(), 40) + "》",
                        "/forum"
                );
            }
        } else {
            postLikeMapper.deleteById(existingLike.getId());
            postMapper.incrementLikeCount(postId, -1);
        }

        return toPostDto(postMapper.selectById(postId), userId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PostDto toggleFavoritePost(Long postId, Long userId) {
        userAccessService.requireActiveUser(userId);
        requirePost(postId);

        QueryWrapper<PostFavorite> queryWrapper = new QueryWrapper<PostFavorite>()
                .eq("post_id", postId)
                .eq("user_id", userId)
                .last("LIMIT 1");
        PostFavorite existingFavorite = postFavoriteMapper.selectOne(queryWrapper);

        if (existingFavorite == null) {
            PostFavorite favorite = new PostFavorite();
            favorite.setPostId(postId);
            favorite.setUserId(userId);
            favorite.setCreateTime(new Date());
            postFavoriteMapper.insert(favorite);
            postMapper.incrementFavoriteCount(postId, 1);
        } else {
            postFavoriteMapper.deleteById(existingFavorite.getId());
            postMapper.incrementFavoriteCount(postId, -1);
        }

        return toPostDto(postMapper.selectById(postId), userId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PostDto updatePinnedStatus(Long postId, Boolean pinned, Long userId) {
        userAccessService.requireAdmin(userId);
        Post post = requirePost(postId);
        post.setPinned(Boolean.TRUE.equals(pinned));
        post.setUpdateTime(new Date());
        postMapper.updateById(post);
        return toPostDto(postMapper.selectById(postId), userId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void reportPost(Long postId, CreatePostReportRequest request, Long userId) {
        User reporter = userAccessService.requireActiveUser(userId);
        Post post = requirePost(postId);

        if (post.getUserId().equals(reporter.getId())) {
            throw ApiException.badRequest("不能举报自己发布的帖子");
        }

        String reason = requireText(request.getReason(), "举报原因不能为空");

        Long existingCount = postReportMapper.selectCount(new QueryWrapper<PostReport>()
                .eq("post_id", postId)
                .eq("reporter_id", userId)
                .eq("status", "PENDING"));

        if (existingCount != null && existingCount > 0) {
            throw ApiException.badRequest("你已经举报过这条帖子，请等待处理");
        }

        PostReport report = new PostReport();
        report.setPostId(postId);
        report.setReporterId(userId);
        report.setReason(limitText(reason, 60));
        report.setDetail(limitText(normalizeNullableText(request.getDetail()), 500));
        report.setStatus("PENDING");
        report.setCreateTime(new Date());
        report.setUpdateTime(new Date());
        postReportMapper.insert(report);
    }

    private Post requirePost(Long id) {
        Post post = postMapper.selectById(id);
        if (post == null) {
            throw ApiException.notFound("帖子不存在");
        }
        return post;
    }

    private PostDto toPostDto(Post post, Long currentUserId) {
        return toPostDtos(List.of(post), currentUserId).stream()
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("帖子不存在"));
    }

    private List<PostDto> toPostDtos(List<Post> posts, Long currentUserId) {
        if (posts == null || posts.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> userIds = posts.stream()
                .map(Post::getUserId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, User> authors = userIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(userIds).stream().collect(Collectors.toMap(User::getId, user -> user));

        Set<Long> likedPostIds = currentUserId == null
                ? Collections.emptySet()
                : postLikeMapper.selectList(new QueryWrapper<PostLike>()
                        .eq("user_id", currentUserId)
                        .in("post_id", posts.stream().map(Post::getId).collect(Collectors.toList())))
                .stream()
                .map(PostLike::getPostId)
                .collect(Collectors.toSet());

        Set<Long> favoritedPostIds = currentUserId == null
                ? Collections.emptySet()
                : postFavoriteMapper.selectList(new QueryWrapper<PostFavorite>()
                        .eq("user_id", currentUserId)
                        .in("post_id", posts.stream().map(Post::getId).collect(Collectors.toList())))
                .stream()
                .map(PostFavorite::getPostId)
                .collect(Collectors.toSet());

        boolean currentUserIsAdmin = currentUserId != null && userAccessService.isAdmin(currentUserId);
        return posts.stream()
                .map(post -> {
                    User author = authors.get(post.getUserId());
                    String authorName = author == null ? post.getAuthor() : author.getNickname();
                    String authorAvatarUrl = author == null ? null : author.getAvatarUrl();
                    boolean canEdit = currentUserId != null && (post.getUserId().equals(currentUserId) || currentUserIsAdmin);
                    return PostDto.fromEntity(
                            post,
                            authorName,
                            authorAvatarUrl,
                            likedPostIds.contains(post.getId()),
                            favoritedPostIds.contains(post.getId()),
                            canEdit
                    );
                })
                .collect(Collectors.toList());
    }

    private ReplyDto toReplyDto(Reply reply) {
        User author = userMapper.selectById(reply.getUserId());
        String authorName = author == null ? reply.getAuthor() : author.getNickname();
        String authorAvatarUrl = author == null ? null : author.getAvatarUrl();
        return ReplyDto.fromEntity(reply, authorName, authorAvatarUrl);
    }

    private String normalizeCategory(String category) {
        String normalized = normalizeNullableText(category);
        return normalized == null ? DEFAULT_CATEGORY : limitText(normalized, 40);
    }

    private String joinTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return null;
        }

        Set<String> normalizedTags = new LinkedHashSet<>();
        for (String tag : tags) {
            String normalized = normalizeNullableText(tag);
            if (normalized == null) {
                continue;
            }
            normalizedTags.add(limitText(normalized, 20));
            if (normalizedTags.size() >= MAX_TAGS) {
                break;
            }
        }

        if (normalizedTags.isEmpty()) {
            return null;
        }
        return String.join(",", normalizedTags);
    }

    private int safeNumber(Integer value) {
        return value == null ? 0 : value;
    }

    private String requireText(String value, String message) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            throw ApiException.badRequest(message);
        }
        return normalized;
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
