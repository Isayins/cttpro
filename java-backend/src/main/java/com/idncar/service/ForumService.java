package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.ForumBoardOwnerApplicationMapper;
import com.idncar.mapper.ForumBoardMapper;
import com.idncar.mapper.ForumBoardUserStatMapper;
import com.idncar.mapper.PostFavoriteMapper;
import com.idncar.mapper.PostLikeMapper;
import com.idncar.mapper.PostMapper;
import com.idncar.mapper.PostReportMapper;
import com.idncar.mapper.ReplyMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.CreatePostReportRequest;
import com.idncar.model.dto.CreatePostRequest;
import com.idncar.model.dto.CreateReplyRequest;
import com.idncar.model.dto.CreateForumBoardOwnerApplicationRequest;
import com.idncar.model.dto.ForumBoardDto;
import com.idncar.model.dto.ForumBoardOwnerApplicationDto;
import com.idncar.model.dto.ForumBoardLevelTitleDto;
import com.idncar.model.dto.ForumLeaderboardDto;
import com.idncar.model.dto.ForumLeaderboardUserDto;
import com.idncar.model.dto.ForumSignInDto;
import com.idncar.model.dto.PostDto;
import com.idncar.model.dto.ReplyDto;
import com.idncar.model.dto.ReviewForumBoardOwnerApplicationRequest;
import com.idncar.model.dto.SaveForumBoardLevelTitlesRequest;
import com.idncar.model.dto.SaveForumBoardRequest;
import com.idncar.model.dto.UserDto;
import com.idncar.model.entity.ForumBoard;
import com.idncar.model.entity.ForumBoardOwnerApplication;
import com.idncar.model.entity.ForumBoardUserStat;
import com.idncar.model.entity.Post;
import com.idncar.model.entity.PostFavorite;
import com.idncar.model.entity.PostLike;
import com.idncar.model.entity.PostReport;
import com.idncar.model.entity.Reply;
import com.idncar.model.entity.User;
import com.idncar.util.RichContentValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@Service
public class ForumService {

    private static final String DEFAULT_CATEGORY = "综合讨论";
    private static final String BOARD_OWNER_APPLICATION_PENDING = "PENDING";
    private static final String BOARD_OWNER_APPLICATION_APPROVED = "APPROVED";
    private static final String BOARD_OWNER_APPLICATION_REJECTED = "REJECTED";
    private static final List<String> DEFAULT_BOARD_NAMES = List.of(DEFAULT_CATEGORY, "求助答疑", "下载反馈", "建议反馈", "问题反馈");
    private static final int MAX_TAGS = 5;
    private static final int EXP_PER_POST = 15;
    private static final int EXP_PER_REPLY = 6;
    private static final int EXP_PER_GIVE_LIKE = 2;
    private static final int EXP_PER_RECEIVE_LIKE = 5;
    private static final int BASE_SIGN_IN_EXP = 8;
    private static final int MAX_SIGN_IN_BONUS_EXP = 14;
    private static final int EXP_PER_LEVEL = 100;
    private static final int ACTIVITY_SCORE_PER_POST = 3;
    private static final int ACTIVITY_SCORE_PER_REPLY = 1;
    private static final int LEADERBOARD_LIMIT = 8;
    private static final long PUBLIC_POST_LIST_CACHE_TTL_MS = 15_000;
    private static final long PUBLIC_POST_DETAIL_CACHE_TTL_MS = 10_000;
    private static final long PUBLIC_REPLY_LIST_CACHE_TTL_MS = 10_000;
    private static final int PUBLIC_POST_LIST_CACHE_MAX_ENTRIES = 200;
    private static final int PUBLIC_POST_DETAIL_CACHE_MAX_ENTRIES = 400;
    private static final int PUBLIC_REPLY_LIST_CACHE_MAX_ENTRIES = 800;
    private static final long LEADERBOARD_CACHE_TTL_MS = 30_000;

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
    private ForumBoardMapper forumBoardMapper;

    @Autowired
    private ForumBoardOwnerApplicationMapper forumBoardOwnerApplicationMapper;

    @Autowired
    private ForumBoardUserStatMapper forumBoardUserStatMapper;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private ObjectMapper objectMapper;

    private final Map<String, TimedPostList> publicPostListCache = new ConcurrentHashMap<>();
    private final Map<Long, TimedPostDetail> publicPostDetailCache = new ConcurrentHashMap<>();
    private final Map<String, TimedReplyList> publicReplyListCache = new ConcurrentHashMap<>();
    private volatile TimedLeaderboard leaderboardCache;

    @Transactional(rollbackFor = Exception.class)
    public PostDto createPost(CreatePostRequest request, Long userId) {
        User user = userAccessService.requireActiveUser(userId);

        Post post = new Post();
        post.setTitle(requireText(request.getTitle(), "帖子标题不能为空"));
        post.setContent(RichContentValidator.requireSafeImageMarkupUrls(requireText(request.getContent(), "帖子内容不能为空")));
        post.setCategory(requireActiveBoardName(request.getCategory()));
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

        addExperience(userId, EXP_PER_POST);
        addBoardExperience(findForumBoardByCategory(post.getCategory()), userId, EXP_PER_POST);
        invalidateForumCaches();
        return toPostDto(postMapper.selectById(post.getId()), userId);
    }

    public List<PostDto> getPosts(int page, int size, String keyword, String category, Boolean mineOnly, Boolean favoritesOnly, Long currentUserId) {
        if ((Boolean.TRUE.equals(mineOnly) || Boolean.TRUE.equals(favoritesOnly)) && currentUserId == null) {
            throw ApiException.unauthorized("请先登录");
        }

        String normalizedKeyword = normalizeNullableText(keyword);
        String normalizedCategory = normalizeCategoryFilter(category);
        boolean cacheablePublicList = currentUserId == null
                && !Boolean.TRUE.equals(mineOnly)
                && !Boolean.TRUE.equals(favoritesOnly)
                && normalizedKeyword == null;

        String publicCacheKey = null;
        if (cacheablePublicList) {
            publicCacheKey = buildPublicPostCacheKey(page, size, normalizedCategory);
            List<PostDto> cachedPosts = getCachedPublicPostList(publicCacheKey);
            if (cachedPosts != null) {
                return cachedPosts;
            }
        }

        Page<Post> postPage = new Page<>(Math.max(page, 1), Math.max(size, 1));
        QueryWrapper<Post> queryWrapper = new QueryWrapper<>();

        if (normalizedKeyword != null) {
            queryWrapper.and(wrapper -> wrapper
                    .like("title", normalizedKeyword)
                    .or()
                    .like("content", normalizedKeyword)
                    .or()
                    .like("tags", normalizedKeyword));
        }

        if (normalizedCategory != null && !isAllCategory(normalizedCategory)) {
            applyCategoryFilter(queryWrapper, normalizedCategory);
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
        List<PostDto> postDtos = toPostDtos(posts, currentUserId);
        if (cacheablePublicList && publicCacheKey != null) {
            cachePublicPostList(publicCacheKey, postDtos);
        }
        return postDtos;
    }

    public PostDto getPostById(Long id, Long currentUserId) {
        if (currentUserId == null) {
            PostDto cached = getCachedPublicPostDetail(id);
            if (cached != null) {
                postMapper.incrementViewCount(id);
                PostDto cachedWithLatestView = copyPostDto(cached);
                cachedWithLatestView.setViewCount((cachedWithLatestView.getViewCount() == null ? 0 : cachedWithLatestView.getViewCount()) + 1);
                cachePublicPostDetail(id, cachedWithLatestView);
                return cachedWithLatestView;
            }
        }

        Post post = requirePost(id);
        postMapper.incrementViewCount(id);
        post.setViewCount((post.getViewCount() == null ? 0 : post.getViewCount()) + 1);
        PostDto dto = toPostDto(post, currentUserId);
        if (currentUserId == null) {
            cachePublicPostDetail(id, dto);
        }
        return dto;
    }

    @Transactional(rollbackFor = Exception.class)
    public PostDto updatePost(Long id, CreatePostRequest request, Long userId) {
        Post post = requirePost(id);
        userAccessService.requireActiveUser(userId);

        if (!post.getUserId().equals(userId) && !userAccessService.isAdmin(userId)) {
            throw ApiException.forbidden("你无权编辑这篇帖子");
        }

        post.setTitle(requireText(request.getTitle(), "帖子标题不能为空"));
        post.setContent(RichContentValidator.requireSafeImageMarkupUrls(requireText(request.getContent(), "帖子内容不能为空")));
        post.setCategory(requireActiveBoardName(request.getCategory()));
        post.setTags(joinTags(request.getTags()));
        post.setUpdateTime(new Date());
        postMapper.updateById(post);
        invalidateForumCaches();
        return toPostDto(postMapper.selectById(id), userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deletePost(Long id, Long userId) {
        Post post = requirePost(id);
        User currentUser = userAccessService.requireActiveUser(userId);

        if (!canDeletePost(post, userId, userAccessService.isAdminRole(currentUser.getRole()), getOwnedBoardNames(userId))) {
            throw ApiException.forbidden("你无权删除这篇帖子");
        }

        postFavoriteMapper.delete(new QueryWrapper<PostFavorite>().eq("post_id", id));
        postLikeMapper.delete(new QueryWrapper<PostLike>().eq("post_id", id));
        replyMapper.delete(new QueryWrapper<Reply>().eq("post_id", id));
        postMapper.deleteById(id);
        invalidateForumCaches();
    }

    @Transactional(rollbackFor = Exception.class)
    public ReplyDto createReply(Long postId, CreateReplyRequest request, Long userId) {
        Post post = requirePost(postId);
        User user = userAccessService.requireActiveUser(userId);

        Reply reply = new Reply();
        reply.setPostId(postId);
        reply.setContent(RichContentValidator.requireSafeImageMarkupUrls(requireText(request.getContent(), "回复内容不能为空")));
        reply.setUserId(userId);
        reply.setAuthor(user.getNickname());
        reply.setCreateTime(new Date());
        reply.setUpdateTime(new Date());
        replyMapper.insert(reply);

        addExperience(userId, EXP_PER_REPLY);
        addBoardExperience(findForumBoardByCategory(post.getCategory()), userId, EXP_PER_REPLY);
        invalidateForumCaches();

        if (!post.getUserId().equals(userId)) {
            notificationService.createNotification(
                    post.getUserId(),
                    "FORUM_REPLY",
                    "你的帖子收到新回复",
                    user.getNickname() + " 回复了你的帖子：" + limitText(post.getTitle(), 40),
                    "/forum"
            );
        }

        return toReplyDto(reply, user, findForumBoardByCategory(post.getCategory()));
    }

    public List<ReplyDto> getReplies(Long postId, int page, int size) {
        String replyCacheKey = buildReplyCacheKey(postId, page, size);
        List<ReplyDto> cachedReplies = getCachedReplyList(replyCacheKey);
        if (cachedReplies != null) {
            return cachedReplies;
        }

        Post post = requirePost(postId);
        Page<Reply> replyPage = new Page<>(Math.max(page, 1), Math.max(size, 1));
        List<Reply> replies = replyMapper.selectByPostId(postId, replyPage);
        List<ReplyDto> replyDtos = toReplyDtos(replies, findForumBoardByCategory(post.getCategory()));
        cacheReplyList(replyCacheKey, replyDtos);
        return replyDtos;
    }

    @Transactional(rollbackFor = Exception.class)
    public PostDto toggleLikePost(Long postId, Long userId) {
        userAccessService.requireActiveUser(userId);
        Post post = requirePost(postId);

        if (post.getUserId().equals(userId)) {
            throw ApiException.badRequest("不能给自己的帖子点赞");
        }

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

            addExperience(userId, EXP_PER_GIVE_LIKE);
            addExperience(post.getUserId(), EXP_PER_RECEIVE_LIKE);

            User currentUser = userMapper.selectById(userId);
            String nickname = currentUser == null ? "User" : currentUser.getNickname();
            notificationService.createNotification(
                    post.getUserId(),
                    "FORUM_LIKE",
                    "你的帖子收到新点赞",
                    nickname + " 点赞了你的帖子：" + limitText(post.getTitle(), 40),
                    "/forum"
            );
        } else {
            postLikeMapper.deleteById(existingLike.getId());
            postMapper.incrementLikeCount(postId, -1);
            addExperience(userId, -EXP_PER_GIVE_LIKE);
            addExperience(post.getUserId(), -EXP_PER_RECEIVE_LIKE);
        }

        invalidateForumCaches();
        return toPostDto(postMapper.selectById(postId), userId);
    }

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

        invalidateForumCaches();
        return toPostDto(postMapper.selectById(postId), userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public PostDto updatePinnedStatus(Long postId, Boolean pinned, Long userId) {
        Post post = requirePost(postId);
        User currentUser = userAccessService.requireActiveUser(userId);
        if (!canPinPost(post, userId, userAccessService.isAdminRole(currentUser.getRole()), getOwnedBoardNames(userId))) {
            throw ApiException.forbidden("你无权管理这个吧的置顶");
        }
        post.setPinned(Boolean.TRUE.equals(pinned));
        post.setUpdateTime(new Date());
        postMapper.updateById(post);
        invalidateForumCaches();
        return toPostDto(postMapper.selectById(postId), userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void reportPost(Long postId, CreatePostReportRequest request, Long userId) {
        User reporter = userAccessService.requireActiveUser(userId);
        Post post = requirePost(postId);

        if (post.getUserId().equals(reporter.getId())) {
            throw ApiException.badRequest("不能举报自己的帖子");
        }

        String reason = requireText(request.getReason(), "举报原因不能为空");

        Long existingCount = postReportMapper.selectCount(new QueryWrapper<PostReport>()
                .eq("post_id", postId)
                .eq("reporter_id", userId)
                .eq("status", "PENDING"));

        if (existingCount != null && existingCount > 0) {
            throw ApiException.badRequest("你已经举报过这篇帖子");
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

    public ForumLeaderboardDto getLeaderboard(Long boardId) {
        if (boardId != null) {
            ForumBoard board = requireForumBoard(boardId);
            ForumLeaderboardDto dto = new ForumLeaderboardDto();
            dto.setSignInRank(buildBoardSignInLeaderboard(board));
            dto.setActivityRank(buildActivityLeaderboard());
            return dto;
        }

        TimedLeaderboard cached = leaderboardCache;
        if (cached != null && System.currentTimeMillis() - cached.cachedAtMillis <= LEADERBOARD_CACHE_TTL_MS) {
            return cached.value;
        }

        ForumLeaderboardDto dto = new ForumLeaderboardDto();
        dto.setSignInRank(buildSignInLeaderboard());
        dto.setActivityRank(buildActivityLeaderboard());
        leaderboardCache = new TimedLeaderboard(dto, System.currentTimeMillis());
        return dto;
    }

    public ForumSignInDto getSignInStatus(Long userId, Long boardId) {
        User user = userAccessService.requireActiveUser(userId);
        if (boardId != null) {
            ForumBoard board = requireForumBoard(boardId);
            ForumBoardUserStat stat = findBoardUserStat(boardId, userId);
            return buildBoardSignInDto(user, board, stat, 0);
        }
        return buildSignInDto(user, 0);
    }

    @Transactional(rollbackFor = Exception.class)
    public ForumSignInDto signIn(Long userId, Long boardId) {
        User user = userAccessService.requireActiveUser(userId);
        if (boardId != null) {
            ForumBoard board = requireForumBoard(boardId);
            if (!Boolean.TRUE.equals(board.getActive())) {
                throw ApiException.badRequest("这个吧已停用，暂时不能签到");
            }
            ForumBoardUserStat stat = findBoardUserStatForUpdate(boardId, userId);
            if (stat == null) {
                stat = new ForumBoardUserStat();
                stat.setBoardId(boardId);
                stat.setUserId(userId);
                stat.setExperience(0);
                stat.setLevel(1);
                stat.setConsecutiveSignInDays(0);
                stat.setCreateTime(new Date());
            }

            LocalDate today = LocalDate.now();
            LocalDate lastSignInDate = toLocalDate(stat.getLastSignInAt());
            if (today.equals(lastSignInDate)) {
                return buildBoardSignInDto(user, board, stat, 0);
            }

            int nextStreak = today.minusDays(1).equals(lastSignInDate) ? safeNumber(stat.getConsecutiveSignInDays()) + 1 : 1;
            int reward = BASE_SIGN_IN_EXP + Math.min(MAX_SIGN_IN_BONUS_EXP, nextStreak * 2);
            int nextExperience = Math.max(0, safeNumber(stat.getExperience()) + reward);
            Date now = new Date();
            stat.setConsecutiveSignInDays(nextStreak);
            stat.setLastSignInAt(now);
            stat.setExperience(nextExperience);
            stat.setLevel(calculateLevel(nextExperience));
            stat.setUpdateTime(now);
            if (stat.getId() == null) {
                forumBoardUserStatMapper.insert(stat);
            } else {
                forumBoardUserStatMapper.updateById(stat);
            }
            invalidateForumCaches();
            return buildBoardSignInDto(user, board, stat, reward);
        }

        LocalDate today = LocalDate.now();
        LocalDate lastSignInDate = toLocalDate(user.getLastSignInAt());

        if (today.equals(lastSignInDate)) {
            return buildSignInDto(user, 0);
        }

        int currentStreak = safeNumber(user.getConsecutiveSignInDays());
        int nextStreak = today.minusDays(1).equals(lastSignInDate) ? currentStreak + 1 : 1;
        int reward = BASE_SIGN_IN_EXP + Math.min(MAX_SIGN_IN_BONUS_EXP, nextStreak * 2);

        user.setConsecutiveSignInDays(nextStreak);
        user.setLastSignInAt(new Date());
        userMapper.updateById(user);

        User updatedUser = addExperience(userId, reward);
        if (updatedUser == null) {
            updatedUser = userMapper.selectById(userId);
        }
        if (updatedUser != null) {
            updatedUser.setConsecutiveSignInDays(nextStreak);
            updatedUser.setLastSignInAt(user.getLastSignInAt());
        }

        return buildSignInDto(updatedUser == null ? user : updatedUser, reward);
    }

    public List<ForumBoardDto> getForumBoards(boolean includeInactive, Long currentUserId) {
        if (includeInactive) {
            userAccessService.requireAdmin(currentUserId);
        }

        QueryWrapper<ForumBoard> queryWrapper = new QueryWrapper<>();
        if (!includeInactive) {
            queryWrapper.eq("active", true);
        }
        queryWrapper.orderByAsc("sort_order").orderByAsc("id");

        List<ForumBoard> boards = forumBoardMapper.selectList(queryWrapper);
        if ((boards == null || boards.isEmpty()) && !includeInactive) {
            return defaultForumBoards();
        }
        return toForumBoardDtos(boards);
    }

    @Transactional(rollbackFor = Exception.class)
    public ForumBoardDto createForumBoard(SaveForumBoardRequest request, Long userId) {
        userAccessService.requireAdmin(userId);
        ForumBoard board = new ForumBoard();
        applyBoardRequest(board, request, null);
        board.setCreateTime(new Date());
        board.setUpdateTime(new Date());
        forumBoardMapper.insert(board);
        invalidateForumCaches();
        return ForumBoardDto.fromEntity(board);
    }

    @Transactional(rollbackFor = Exception.class)
    public ForumBoardDto updateForumBoard(Long id, SaveForumBoardRequest request, Long userId) {
        userAccessService.requireAdmin(userId);
        ForumBoard board = requireForumBoard(id);
        String previousName = board.getName();
        applyBoardRequest(board, request, id);
        Date now = new Date();
        board.setUpdateTime(now);
        forumBoardMapper.update(null, new UpdateWrapper<ForumBoard>()
                .eq("id", id)
                .set("name", board.getName())
                .set("description", board.getDescription())
                .set("avatar_url", board.getAvatarUrl())
                .set("sort_order", board.getSortOrder())
                .set("active", board.getActive())
                .set("update_time", now));

        if (previousName != null && !previousName.equals(board.getName())) {
            postMapper.update(null, new UpdateWrapper<Post>()
                    .in("category", resolveCategoryAliases(previousName))
                    .set("category", board.getName()));
        }

        invalidateForumCaches();
        return ForumBoardDto.fromEntity(forumBoardMapper.selectById(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public ForumBoardDto updateForumBoardLevelTitles(Long id, SaveForumBoardLevelTitlesRequest request, Long userId) {
        ForumBoard board = requireForumBoard(id);
        requireBoardManager(board, userId);
        String levelTitleConfig = serializeLevelTitles(normalizeLevelTitles(request == null ? null : request.getTitles()));
        Date now = new Date();
        forumBoardMapper.update(null, new UpdateWrapper<ForumBoard>()
                .eq("id", id)
                .set("level_title_config", levelTitleConfig)
                .set("update_time", now));
        board.setLevelTitleConfig(levelTitleConfig);
        board.setUpdateTime(now);
        invalidateForumCaches();
        return ForumBoardDto.fromEntity(board, userMapper.selectById(board.getOwnerUserId()));
    }

    @Transactional(rollbackFor = Exception.class)
    public ForumBoardOwnerApplicationDto applyForumBoardOwner(Long boardId, CreateForumBoardOwnerApplicationRequest request, Long userId) {
        User applicant = userAccessService.requireActiveUser(userId);
        ForumBoard board = requireForumBoardForUpdate(boardId);
        if (!Boolean.TRUE.equals(board.getActive())) {
            throw ApiException.badRequest("这个吧已停用，暂时不能申请吧主");
        }
        if (hasBoardOwner(board)) {
            if (Objects.equals(board.getOwnerUserId(), userId)) {
                throw ApiException.badRequest("你已经是这个吧的吧主");
            }
            throw ApiException.badRequest("这个吧已经有吧主了");
        }
        if (Objects.equals(board.getOwnerUserId(), userId)) {
            throw ApiException.badRequest("你已经是这个吧的吧主");
        }

        boolean hasPendingApplication = !forumBoardOwnerApplicationMapper.selectList(new QueryWrapper<ForumBoardOwnerApplication>()
                .eq("board_id", boardId)
                .eq("applicant_id", userId)
                .eq("status", BOARD_OWNER_APPLICATION_PENDING)
                .last("FOR UPDATE")).isEmpty();
        if (hasPendingApplication) {
            throw ApiException.badRequest("你已经提交过这个吧的吧主申请，请等待管理员审核");
        }

        ForumBoardOwnerApplication application = new ForumBoardOwnerApplication();
        application.setBoardId(boardId);
        application.setApplicantId(userId);
        application.setReason(limitText(requireText(request == null ? null : request.getReason(), "申请理由不能为空"), 500));
        application.setStatus(BOARD_OWNER_APPLICATION_PENDING);
        application.setCreateTime(new Date());
        application.setUpdateTime(new Date());
        forumBoardOwnerApplicationMapper.insert(application);
        return ForumBoardOwnerApplicationDto.fromEntity(application, board, applicant);
    }

    public List<ForumBoardOwnerApplicationDto> getMyForumBoardOwnerApplications(String status, Long userId) {
        userAccessService.requireActiveUser(userId);
        String normalizedStatus = normalizeApplicationStatus(status);
        QueryWrapper<ForumBoardOwnerApplication> queryWrapper = new QueryWrapper<ForumBoardOwnerApplication>()
                .eq("applicant_id", userId);
        if (normalizedStatus != null) {
            queryWrapper.eq("status", normalizedStatus);
        }
        queryWrapper.orderByDesc("create_time");
        List<ForumBoardOwnerApplication> applications = forumBoardOwnerApplicationMapper.selectList(queryWrapper);
        return toForumBoardOwnerApplicationDtos(applications);
    }

    public List<ForumBoardOwnerApplicationDto> getForumBoardOwnerApplications(String status, Long userId) {
        userAccessService.requireAdmin(userId);
        String normalizedStatus = normalizeApplicationStatus(status);
        QueryWrapper<ForumBoardOwnerApplication> queryWrapper = new QueryWrapper<>();
        if (normalizedStatus != null) {
            queryWrapper.eq("status", normalizedStatus);
        }
        queryWrapper.orderByDesc("create_time");
        List<ForumBoardOwnerApplication> applications = forumBoardOwnerApplicationMapper.selectList(queryWrapper);
        return toForumBoardOwnerApplicationDtos(applications);
    }

    @Transactional(rollbackFor = Exception.class)
    public ForumBoardOwnerApplicationDto reviewForumBoardOwnerApplication(Long applicationId, ReviewForumBoardOwnerApplicationRequest request, Long userId) {
        userAccessService.requireAdmin(userId);
        ForumBoardOwnerApplication application = forumBoardOwnerApplicationMapper.selectById(applicationId);
        if (application == null) {
            throw ApiException.notFound("吧主申请不存在");
        }
        if (!BOARD_OWNER_APPLICATION_PENDING.equals(application.getStatus())) {
            throw ApiException.badRequest("这个申请已经审核过");
        }
        if (request == null || request.getApproved() == null) {
            throw ApiException.badRequest("请选择审核结果");
        }

        ForumBoard board = requireForumBoard(application.getBoardId());
        String nextStatus = Boolean.TRUE.equals(request.getApproved()) ? BOARD_OWNER_APPLICATION_APPROVED : BOARD_OWNER_APPLICATION_REJECTED;
        String reviewNote = limitText(normalizeNullableText(request.getReviewNote()), 500);
        Date reviewedAt = new Date();
        int updated = forumBoardOwnerApplicationMapper.update(null, new UpdateWrapper<ForumBoardOwnerApplication>()
                .eq("id", applicationId)
                .eq("status", BOARD_OWNER_APPLICATION_PENDING)
                .set("status", nextStatus)
                .set("reviewed_by", userId)
                .set("review_note", reviewNote)
                .set("reviewed_at", reviewedAt)
                .set("update_time", reviewedAt));
        if (updated <= 0) {
            throw ApiException.badRequest("这个申请已经审核过");
        }

        application.setStatus(nextStatus);
        application.setReviewedBy(userId);
        application.setReviewNote(reviewNote);
        application.setReviewedAt(reviewedAt);
        application.setUpdateTime(reviewedAt);

        if (Boolean.TRUE.equals(request.getApproved())) {
            int boardUpdated = forumBoardMapper.update(null, new UpdateWrapper<ForumBoard>()
                    .eq("id", board.getId())
                    .and(wrapper -> wrapper.isNull("owner_user_id").or().eq("owner_user_id", 0))
                    .set("owner_user_id", application.getApplicantId())
                    .set("update_time", reviewedAt));
            if (boardUpdated <= 0) {
                throw ApiException.badRequest("这个吧已经有吧主了");
            }
            board.setOwnerUserId(application.getApplicantId());
            board.setUpdateTime(reviewedAt);
            rejectOtherPendingBoardOwnerApplications(board, application.getId(), userId);
        }

        notifyBoardOwnerApplicationReviewed(application, board);
        invalidateForumCaches();
        return ForumBoardOwnerApplicationDto.fromEntity(
                application,
                forumBoardMapper.selectById(board.getId()),
                userMapper.selectById(application.getApplicantId())
        );
    }

    private ForumBoard requireForumBoard(Long id) {
        ForumBoard board = forumBoardMapper.selectById(id);
        if (board == null) {
            throw ApiException.notFound("吧不存在");
        }
        return board;
    }

    private ForumBoard requireForumBoardForUpdate(Long id) {
        ForumBoard board = forumBoardMapper.selectOne(new QueryWrapper<ForumBoard>()
                .eq("id", id)
                .last("FOR UPDATE"));
        if (board == null) {
            throw ApiException.notFound("吧不存在");
        }
        return board;
    }

    private List<ForumBoardDto> toForumBoardDtos(List<ForumBoard> boards) {
        if (boards == null || boards.isEmpty()) {
            return Collections.emptyList();
        }
        List<Long> ownerIds = boards.stream()
                .map(ForumBoard::getOwnerUserId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, User> owners = ownerIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(ownerIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return boards.stream()
                .map(board -> ForumBoardDto.fromEntity(board, owners.get(board.getOwnerUserId())))
                .collect(Collectors.toList());
    }

    private List<ForumBoardOwnerApplicationDto> toForumBoardOwnerApplicationDtos(List<ForumBoardOwnerApplication> applications) {
        if (applications == null || applications.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> boardIds = applications.stream()
                .map(ForumBoardOwnerApplication::getBoardId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        List<Long> applicantIds = applications.stream()
                .map(ForumBoardOwnerApplication::getApplicantId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, ForumBoard> boards = boardIds.isEmpty()
                ? Collections.emptyMap()
                : forumBoardMapper.selectBatchIds(boardIds).stream().collect(Collectors.toMap(ForumBoard::getId, Function.identity()));
        Map<Long, User> applicants = applicantIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(applicantIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));

        return applications.stream()
                .map(application -> ForumBoardOwnerApplicationDto.fromEntity(
                        application,
                        boards.get(application.getBoardId()),
                        applicants.get(application.getApplicantId())
                ))
                .collect(Collectors.toList());
    }

    private String normalizeApplicationStatus(String status) {
        String normalized = normalizeNullableText(status);
        if (normalized == null) {
            return null;
        }
        String upperCase = normalized.toUpperCase();
        switch (upperCase) {
            case BOARD_OWNER_APPLICATION_PENDING:
            case BOARD_OWNER_APPLICATION_APPROVED:
            case BOARD_OWNER_APPLICATION_REJECTED:
                return upperCase;
            default:
                throw ApiException.badRequest("申请状态无效");
        }
    }

    private void rejectOtherPendingBoardOwnerApplications(ForumBoard board, Long approvedApplicationId, Long reviewerId) {
        if (board == null || board.getId() == null || approvedApplicationId == null) {
            return;
        }
        List<ForumBoardOwnerApplication> rejectedApplications = forumBoardOwnerApplicationMapper.selectList(new QueryWrapper<ForumBoardOwnerApplication>()
                .eq("board_id", board.getId())
                .eq("status", BOARD_OWNER_APPLICATION_PENDING)
                .ne("id", approvedApplicationId));
        if (rejectedApplications.isEmpty()) {
            return;
        }
        Date now = new Date();
        forumBoardOwnerApplicationMapper.update(null, new UpdateWrapper<ForumBoardOwnerApplication>()
                .eq("board_id", board.getId())
                .eq("status", BOARD_OWNER_APPLICATION_PENDING)
                .ne("id", approvedApplicationId)
                .set("status", BOARD_OWNER_APPLICATION_REJECTED)
                .set("reviewed_by", reviewerId)
                .set("review_note", "已有吧主申请通过")
                .set("reviewed_at", now)
                .set("update_time", now));
        for (ForumBoardOwnerApplication rejectedApplication : rejectedApplications) {
            rejectedApplication.setStatus(BOARD_OWNER_APPLICATION_REJECTED);
            rejectedApplication.setReviewedBy(reviewerId);
            rejectedApplication.setReviewNote("已有吧主申请通过");
            rejectedApplication.setReviewedAt(now);
            rejectedApplication.setUpdateTime(now);
            notifyBoardOwnerApplicationReviewed(rejectedApplication, board);
        }
    }

    private void notifyBoardOwnerApplicationReviewed(ForumBoardOwnerApplication application, ForumBoard board) {
        if (application == null || board == null) {
            return;
        }
        boolean approved = BOARD_OWNER_APPLICATION_APPROVED.equals(application.getStatus());
        String boardName = board.getName() == null ? "该吧" : board.getName() + "吧";
        notificationService.createNotification(
                application.getApplicantId(),
                "FORUM_BOARD_OWNER_APPLICATION",
                approved ? "吧主申请已通过" : "吧主申请未通过",
                approved ? "你已成为" + boardName + "的吧主。" : "你申请成为" + boardName + "吧主的申请未通过。",
                "/forum"
        );
    }

    private void applyBoardRequest(ForumBoard board, SaveForumBoardRequest request, Long currentBoardId) {
        String name = normalizeBoardName(request == null ? null : request.getName());
        ensureUniqueBoardName(name, currentBoardId);
        board.setName(name);
        board.setDescription(limitText(normalizeNullableText(request == null ? null : request.getDescription()), 200));
        board.setAvatarUrl(normalizeBoardAvatarUrl(request == null ? null : request.getAvatarUrl()));
        board.setSortOrder(request == null || request.getSortOrder() == null ? 0 : request.getSortOrder());
        board.setActive(request == null || request.getActive() == null || Boolean.TRUE.equals(request.getActive()));
    }

    private void ensureUniqueBoardName(String name, Long currentBoardId) {
        QueryWrapper<ForumBoard> queryWrapper = new QueryWrapper<ForumBoard>()
                .eq("name", name);
        if (currentBoardId != null) {
            queryWrapper.ne("id", currentBoardId);
        }
        Long count = forumBoardMapper.selectCount(queryWrapper);
        if (count != null && count > 0) {
            throw ApiException.badRequest("这个吧已经存在");
        }
    }

    private String requireActiveBoardName(String category) {
        String normalized = normalizeCategory(category);
        ForumBoard board = findForumBoardByCategory(normalized);
        if (board == null) {
            if (DEFAULT_BOARD_NAMES.contains(normalized)) {
                return normalized;
            }
            throw ApiException.badRequest("请选择已创建的吧");
        }
        if (!Boolean.TRUE.equals(board.getActive())) {
            throw ApiException.badRequest("这个吧已停用，暂时不能发帖");
        }
        return board.getName();
    }

    private ForumBoard findForumBoardByCategory(String category) {
        List<String> aliases = resolveCategoryAliases(category);
        QueryWrapper<ForumBoard> queryWrapper = new QueryWrapper<ForumBoard>()
                .in("name", aliases)
                .last("LIMIT 1");
        return forumBoardMapper.selectOne(queryWrapper);
    }

    private String normalizeBoardName(String value) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            throw ApiException.badRequest("吧名称不能为空");
        }
        if (isAllCategory(normalized)) {
            throw ApiException.badRequest("吧名称不能使用“全部”");
        }
        return canonicalCategory(limitText(normalized, 40));
    }

    private String normalizeBoardAvatarUrl(String value) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            return null;
        }
        if (normalized.length() > 500) {
            throw ApiException.badRequest("吧头像链接不能超过 500 个字符");
        }
        if (normalized.startsWith("/uploads/") || normalized.startsWith("/api/uploads/")) {
            return normalized;
        }
        if (normalized.startsWith("//")) {
            return normalized;
        }
        try {
            String scheme = URI.create(normalized).getScheme();
            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                return normalized;
            }
        } catch (IllegalArgumentException ignored) {
            // Fall through to the validation error below.
        }
        throw ApiException.badRequest("请输入有效的吧头像链接");
    }

    private boolean hasBoardOwner(ForumBoard board) {
        return board != null && board.getOwnerUserId() != null && board.getOwnerUserId() > 0;
    }

    private void requireBoardManager(ForumBoard board, Long userId) {
        User user = userAccessService.requireActiveUser(userId);
        if (userAccessService.isAdminRole(user.getRole()) || Objects.equals(board.getOwnerUserId(), userId)) {
            return;
        }
        throw ApiException.forbidden("仅管理员或该吧吧主可以执行此操作");
    }

    private ForumBoardUserStat findBoardUserStat(Long boardId, Long userId) {
        if (boardId == null || userId == null) {
            return null;
        }
        return forumBoardUserStatMapper.selectOne(new QueryWrapper<ForumBoardUserStat>()
                .eq("board_id", boardId)
                .eq("user_id", userId)
                .last("LIMIT 1"));
    }

    private ForumBoardUserStat findBoardUserStatForUpdate(Long boardId, Long userId) {
        if (boardId == null || userId == null) {
            return null;
        }
        return forumBoardUserStatMapper.selectOne(new QueryWrapper<ForumBoardUserStat>()
                .eq("board_id", boardId)
                .eq("user_id", userId)
                .last("FOR UPDATE"));
    }

    private List<ForumBoardLevelTitleDto> normalizeLevelTitles(List<ForumBoardLevelTitleDto> titles) {
        if (titles == null || titles.isEmpty()) {
            return Collections.emptyList();
        }
        Map<Integer, ForumBoardLevelTitleDto> normalized = new HashMap<>();
        for (ForumBoardLevelTitleDto item : titles) {
            if (item == null || item.getLevel() == null) {
                continue;
            }
            String title = normalizeNullableText(item.getTitle());
            if (title == null) {
                continue;
            }
            ForumBoardLevelTitleDto dto = new ForumBoardLevelTitleDto();
            dto.setLevel(Math.max(1, Math.min(100, item.getLevel())));
            dto.setTitle(limitText(title, 20));
            normalized.put(dto.getLevel(), dto);
        }
        return normalized.values().stream()
                .sorted(Comparator.comparingInt(ForumBoardLevelTitleDto::getLevel))
                .limit(20)
                .collect(Collectors.toList());
    }

    private String serializeLevelTitles(List<ForumBoardLevelTitleDto> titles) {
        if (titles == null || titles.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(titles);
        } catch (Exception e) {
            throw ApiException.badRequest("等级头衔配置无效");
        }
    }

    private List<ForumBoardLevelTitleDto> parseLevelTitles(String levelTitleConfig) {
        String normalized = normalizeNullableText(levelTitleConfig);
        if (normalized == null) {
            return Collections.emptyList();
        }
        try {
            return normalizeLevelTitles(objectMapper.readValue(normalized, new TypeReference<List<ForumBoardLevelTitleDto>>() {
            }));
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String resolveBoardLevelTitle(ForumBoard board, int level) {
        List<ForumBoardLevelTitleDto> titles = parseLevelTitles(board == null ? null : board.getLevelTitleConfig());
        String matchedTitle = null;
        for (ForumBoardLevelTitleDto item : titles) {
            if (item.getLevel() != null && item.getLevel() <= level) {
                matchedTitle = item.getTitle();
            }
        }
        return matchedTitle == null ? UserDto.resolveTitle(level) : matchedTitle;
    }

    private Set<String> getOwnedBoardNames(Long userId) {
        if (userId == null) {
            return Collections.emptySet();
        }
        return forumBoardMapper.selectList(new QueryWrapper<ForumBoard>()
                        .select("name")
                        .eq("owner_user_id", userId))
                .stream()
                .map(ForumBoard::getName)
                .filter(name -> name != null && !name.isBlank())
                .collect(Collectors.toSet());
    }

    private boolean canDeletePost(Post post, Long userId, boolean currentUserIsAdmin, Set<String> ownedBoardNames) {
        return userId != null
                && post != null
                && (Objects.equals(post.getUserId(), userId)
                || currentUserIsAdmin
                || isOwnedBoardCategory(post.getCategory(), ownedBoardNames));
    }

    private boolean canPinPost(Post post, Long userId, boolean currentUserIsAdmin, Set<String> ownedBoardNames) {
        return userId != null
                && post != null
                && (currentUserIsAdmin || isOwnedBoardCategory(post.getCategory(), ownedBoardNames));
    }

    private boolean isOwnedBoardCategory(String category, Set<String> ownedBoardNames) {
        if (ownedBoardNames == null || ownedBoardNames.isEmpty()) {
            return false;
        }
        return resolveCategoryAliases(category).stream().anyMatch(ownedBoardNames::contains);
    }

    private List<ForumBoardDto> defaultForumBoards() {
        return DEFAULT_BOARD_NAMES.stream()
                .map(name -> {
                    ForumBoard board = new ForumBoard();
                    board.setName(name);
                    board.setDescription(defaultBoardDescription(name));
                    board.setSortOrder(DEFAULT_BOARD_NAMES.indexOf(name) + 1);
                    board.setActive(true);
                    return ForumBoardDto.fromEntity(board);
                })
                .collect(Collectors.toList());
    }

    private String defaultBoardDescription(String name) {
        switch (name) {
            case "求助答疑":
                return "提问、排查和经验互助";
            case "下载反馈":
                return "下载资源、安装和版本反馈";
            case "建议反馈":
                return "产品建议和体验优化";
            case "问题反馈":
                return "问题报告和异常反馈";
            default:
                return "日常交流和主题讨论";
        }
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

        List<Long> postIds = posts.stream().map(Post::getId).collect(Collectors.toList());
        List<Long> userIds = posts.stream()
                .map(Post::getUserId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, User> authors = userIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(userIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));

        Map<Long, Long> replyCountMap = postIds.isEmpty()
                ? Collections.emptyMap()
                : replyMapper.selectReplyCountByPostIds(postIds).stream()
                .filter(row -> row.get("postId") instanceof Number && row.get("replyCount") instanceof Number)
                .collect(Collectors.toMap(
                        row -> ((Number) row.get("postId")).longValue(),
                        row -> ((Number) row.get("replyCount")).longValue()
                ));

        Set<Long> likedPostIds = currentUserId == null || postIds.isEmpty()
                ? Collections.emptySet()
                : postLikeMapper.selectList(new QueryWrapper<PostLike>()
                        .select("post_id")
                        .eq("user_id", currentUserId)
                        .in("post_id", postIds))
                .stream()
                .map(PostLike::getPostId)
                .collect(Collectors.toSet());

        Set<Long> favoritedPostIds = currentUserId == null || postIds.isEmpty()
                ? Collections.emptySet()
                : postFavoriteMapper.selectList(new QueryWrapper<PostFavorite>()
                        .select("post_id")
                        .eq("user_id", currentUserId)
                        .in("post_id", postIds))
                .stream()
                .map(PostFavorite::getPostId)
                .collect(Collectors.toSet());

        boolean currentUserIsAdmin = currentUserId != null && userAccessService.isAdmin(currentUserId);
        Set<String> currentUserOwnedBoardNames = currentUserId == null || currentUserIsAdmin
                ? Collections.emptySet()
                : getOwnedBoardNames(currentUserId);

        return posts.stream()
                .map(post -> {
                    User author = authors.get(post.getUserId());
                    String authorName = author == null ? post.getAuthor() : author.getNickname();
                    String authorAvatarUrl = author == null ? null : author.getAvatarUrl();
                    Integer authorExperience = author == null || author.getExperience() == null ? 0 : author.getExperience();
                    Integer authorLevel = author == null || author.getLevel() == null ? 1 : author.getLevel();
                    ForumBoard postBoard = findForumBoardByCategory(post.getCategory());
                    ForumBoardUserStat authorBoardStat = postBoard == null ? null : findBoardUserStat(postBoard.getId(), post.getUserId());
                    if (authorBoardStat != null) {
                        authorExperience = authorBoardStat.getExperience() == null ? 0 : authorBoardStat.getExperience();
                        authorLevel = authorBoardStat.getLevel() == null ? 1 : authorBoardStat.getLevel();
                    }
                    String authorTitle = resolveBoardLevelTitle(postBoard, authorLevel);
                    Integer replyCount = Math.toIntExact(replyCountMap.getOrDefault(post.getId(), 0L));
                    boolean canEdit = currentUserId != null && (Objects.equals(post.getUserId(), currentUserId) || currentUserIsAdmin);
                    boolean canDelete = canDeletePost(post, currentUserId, currentUserIsAdmin, currentUserOwnedBoardNames);
                    boolean canPin = canPinPost(post, currentUserId, currentUserIsAdmin, currentUserOwnedBoardNames);
                    return PostDto.fromEntity(
                            post,
                            authorName,
                            authorAvatarUrl,
                            authorExperience,
                            authorLevel,
                            authorTitle,
                            replyCount,
                            likedPostIds.contains(post.getId()),
                            favoritedPostIds.contains(post.getId()),
                            canEdit,
                            canDelete,
                            canPin
                    );
                })
                .collect(Collectors.toList());
    }

    private List<ReplyDto> toReplyDtos(List<Reply> replies, ForumBoard board) {
        if (replies == null || replies.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> userIds = replies.stream()
                .map(Reply::getUserId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, User> authors = userIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(userIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));

        return replies.stream()
                .map(reply -> toReplyDto(reply, authors.get(reply.getUserId()), board))
                .collect(Collectors.toList());
    }

    private ReplyDto toReplyDto(Reply reply, User author, ForumBoard board) {
        String authorName = author == null ? reply.getAuthor() : author.getNickname();
        String authorAvatarUrl = author == null ? null : author.getAvatarUrl();
        Integer authorExperience = author == null || author.getExperience() == null ? 0 : author.getExperience();
        Integer authorLevel = author == null || author.getLevel() == null ? 1 : author.getLevel();
        ForumBoardUserStat boardStat = board == null ? null : findBoardUserStat(board.getId(), reply.getUserId());
        if (boardStat != null) {
            authorExperience = boardStat.getExperience() == null ? 0 : boardStat.getExperience();
            authorLevel = boardStat.getLevel() == null ? 1 : boardStat.getLevel();
        }
        String authorTitle = resolveBoardLevelTitle(board, authorLevel);
        return ReplyDto.fromEntity(reply, authorName, authorAvatarUrl, authorExperience, authorLevel, authorTitle);
    }

    private User addExperience(Long userId, int delta) {
        if (userId == null || delta == 0) {
            return userId == null ? null : userMapper.selectById(userId);
        }

        User user = userMapper.selectById(userId);
        if (user == null) {
            return null;
        }

        int nextExperience = Math.max(0, safeNumber(user.getExperience()) + delta);
        user.setExperience(nextExperience);
        user.setLevel(calculateLevel(nextExperience));
        userMapper.updateById(user);
        return user;
    }

    private ForumBoardUserStat addBoardExperience(ForumBoard board, Long userId, int delta) {
        if (board == null || board.getId() == null || userId == null || delta == 0) {
            return null;
        }
        ForumBoardUserStat stat = findBoardUserStatForUpdate(board.getId(), userId);
        if (stat == null) {
            stat = new ForumBoardUserStat();
            stat.setBoardId(board.getId());
            stat.setUserId(userId);
            stat.setExperience(0);
            stat.setLevel(1);
            stat.setConsecutiveSignInDays(0);
            stat.setCreateTime(new Date());
        }
        int nextExperience = Math.max(0, safeNumber(stat.getExperience()) + delta);
        stat.setExperience(nextExperience);
        stat.setLevel(calculateLevel(nextExperience));
        stat.setUpdateTime(new Date());
        if (stat.getId() == null) {
            forumBoardUserStatMapper.insert(stat);
        } else {
            forumBoardUserStatMapper.updateById(stat);
        }
        return stat;
    }

    private int calculateLevel(int experience) {
        return Math.max(1, experience / EXP_PER_LEVEL + 1);
    }

    private List<ForumLeaderboardUserDto> buildSignInLeaderboard() {
        List<User> users = userMapper.selectList(new QueryWrapper<User>()
                .eq("status", "ACTIVE")
                .gt("consecutive_sign_in_days", 0)
                .orderByDesc("consecutive_sign_in_days")
                .orderByDesc("experience")
                .last("LIMIT " + LEADERBOARD_LIMIT));

        if (users == null || users.isEmpty()) {
            return Collections.emptyList();
        }

        return users.stream()
                .map(user -> toLeaderboardUserDto(user, 0, 0))
                .collect(Collectors.toList());
    }

    private List<ForumLeaderboardUserDto> buildBoardSignInLeaderboard(ForumBoard board) {
        if (board == null || board.getId() == null) {
            return Collections.emptyList();
        }
        List<ForumBoardUserStat> stats = forumBoardUserStatMapper.selectList(new QueryWrapper<ForumBoardUserStat>()
                .eq("board_id", board.getId())
                .gt("consecutive_sign_in_days", 0)
                .orderByDesc("consecutive_sign_in_days")
                .orderByDesc("experience")
                .last("LIMIT " + LEADERBOARD_LIMIT));
        if (stats == null || stats.isEmpty()) {
            return Collections.emptyList();
        }
        List<Long> userIds = stats.stream()
                .map(ForumBoardUserStat::getUserId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, User> users = userIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(userIds).stream()
                .filter(user -> user != null && "ACTIVE".equals(user.getStatus()))
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return stats.stream()
                .map(stat -> toBoardLeaderboardUserDto(stat, board, users.get(stat.getUserId())))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    private List<ForumLeaderboardUserDto> buildActivityLeaderboard() {
        LocalDate today = LocalDate.now();
        Date startTime = Date.from(today.atStartOfDay(ZoneId.systemDefault()).toInstant());
        Date endTime = Date.from(today.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant());

        List<Post> todayPosts = postMapper.selectList(new QueryWrapper<Post>()
                .ge("create_time", startTime)
                .lt("create_time", endTime));
        List<Reply> todayReplies = replyMapper.selectList(new QueryWrapper<Reply>()
                .ge("create_time", startTime)
                .lt("create_time", endTime));

        Map<Long, ActivityStats> statsMap = new HashMap<>();

        for (Post post : todayPosts) {
            if (post.getUserId() == null) {
                continue;
            }
            statsMap.computeIfAbsent(post.getUserId(), key -> new ActivityStats()).postCount++;
        }

        for (Reply reply : todayReplies) {
            if (reply.getUserId() == null) {
                continue;
            }
            statsMap.computeIfAbsent(reply.getUserId(), key -> new ActivityStats()).replyCount++;
        }

        if (statsMap.isEmpty()) {
            return Collections.emptyList();
        }

        Map<Long, User> users = userMapper.selectBatchIds(statsMap.keySet()).stream()
                .filter(user -> user != null && "ACTIVE".equals(user.getStatus()))
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return statsMap.entrySet().stream()
                .map(entry -> {
                    User user = users.get(entry.getKey());
                    if (user == null) {
                        return null;
                    }
                    return toLeaderboardUserDto(user, entry.getValue().postCount, entry.getValue().replyCount);
                })
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparingInt(ForumLeaderboardUserDto::getActivityScore).reversed()
                        .thenComparing(ForumLeaderboardUserDto::getPostCountToday, Comparator.reverseOrder())
                        .thenComparing(ForumLeaderboardUserDto::getReplyCountToday, Comparator.reverseOrder())
                        .thenComparing(ForumLeaderboardUserDto::getExperience, Comparator.reverseOrder()))
                .limit(LEADERBOARD_LIMIT)
                .collect(Collectors.toList());
    }

    private LocalDate toLocalDate(Date date) {
        if (date == null) {
            return null;
        }
        return Instant.ofEpochMilli(date.getTime()).atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private ForumLeaderboardUserDto toLeaderboardUserDto(User user, int postCountToday, int replyCountToday) {
        ForumLeaderboardUserDto dto = new ForumLeaderboardUserDto();
        int level = user == null || user.getLevel() == null ? 1 : user.getLevel();
        int experience = user == null || user.getExperience() == null ? 0 : user.getExperience();
        int signInDays = user == null || user.getConsecutiveSignInDays() == null ? 0 : user.getConsecutiveSignInDays();
        int normalizedPostCount = Math.max(0, postCountToday);
        int normalizedReplyCount = Math.max(0, replyCountToday);
        dto.setUserId(user == null ? null : user.getId());
        dto.setNickname(user == null ? null : user.getNickname());
        dto.setAvatarUrl(user == null ? null : user.getAvatarUrl());
        dto.setLevel(level);
        dto.setExperience(experience);
        dto.setTitle(UserDto.resolveTitle(level));
        dto.setConsecutiveSignInDays(signInDays);
        dto.setPostCountToday(normalizedPostCount);
        dto.setReplyCountToday(normalizedReplyCount);
        dto.setActivityScore(normalizedPostCount * ACTIVITY_SCORE_PER_POST + normalizedReplyCount * ACTIVITY_SCORE_PER_REPLY);
        return dto;
    }

    private ForumLeaderboardUserDto toBoardLeaderboardUserDto(ForumBoardUserStat stat, ForumBoard board, User user) {
        if (stat == null || user == null) {
            return null;
        }
        ForumLeaderboardUserDto dto = new ForumLeaderboardUserDto();
        int level = stat.getLevel() == null ? 1 : stat.getLevel();
        int experience = stat.getExperience() == null ? 0 : stat.getExperience();
        dto.setUserId(user.getId());
        dto.setNickname(user.getNickname());
        dto.setAvatarUrl(user.getAvatarUrl());
        dto.setLevel(level);
        dto.setExperience(experience);
        dto.setTitle(resolveBoardLevelTitle(board, level));
        dto.setConsecutiveSignInDays(stat.getConsecutiveSignInDays() == null ? 0 : stat.getConsecutiveSignInDays());
        dto.setPostCountToday(0);
        dto.setReplyCountToday(0);
        dto.setActivityScore(0);
        return dto;
    }

    private ForumSignInDto buildSignInDto(User user, int gainedExperience) {
        ForumSignInDto dto = new ForumSignInDto();
        int level = user == null || user.getLevel() == null ? 1 : user.getLevel();
        int experience = user == null || user.getExperience() == null ? 0 : user.getExperience();
        Date lastSignInAt = user == null ? null : user.getLastSignInAt();
        LocalDate today = LocalDate.now();

        dto.setSignedToday(today.equals(toLocalDate(lastSignInAt)));
        dto.setConsecutiveSignInDays(user == null || user.getConsecutiveSignInDays() == null ? 0 : user.getConsecutiveSignInDays());
        dto.setGainedExperience(Math.max(0, gainedExperience));
        dto.setExperience(experience);
        dto.setLevel(level);
        dto.setTitle(UserDto.resolveTitle(level));
        dto.setLastSignInAt(lastSignInAt == null ? null : new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(lastSignInAt));
        return dto;
    }

    private ForumSignInDto buildBoardSignInDto(User user, ForumBoard board, ForumBoardUserStat stat, int gainedExperience) {
        ForumSignInDto dto = new ForumSignInDto();
        int level = stat == null || stat.getLevel() == null ? 1 : stat.getLevel();
        int experience = stat == null || stat.getExperience() == null ? 0 : stat.getExperience();
        int consecutiveDays = stat == null || stat.getConsecutiveSignInDays() == null ? 0 : stat.getConsecutiveSignInDays();
        Date lastSignInAt = stat == null ? null : stat.getLastSignInAt();
        LocalDate today = LocalDate.now();
        dto.setBoardId(board == null ? null : board.getId());
        dto.setBoardName(board == null ? null : board.getName());
        dto.setSignedToday(today.equals(toLocalDate(lastSignInAt)));
        dto.setConsecutiveSignInDays(consecutiveDays);
        dto.setGainedExperience(Math.max(0, gainedExperience));
        dto.setExperience(experience);
        dto.setLevel(level);
        dto.setTitle(resolveBoardLevelTitle(board, level));
        dto.setLastSignInAt(lastSignInAt == null ? null : new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(lastSignInAt));
        return dto;
    }

    private String normalizeCategory(String category) {
        String normalized = normalizeNullableText(category);
        return normalized == null ? DEFAULT_CATEGORY : canonicalCategory(limitText(normalized, 40));
    }

    private String normalizeCategoryFilter(String category) {
        String normalized = normalizeNullableText(category);
        return normalized == null ? null : canonicalCategory(limitText(normalized, 40));
    }

    private void applyCategoryFilter(QueryWrapper<Post> queryWrapper, String category) {
        List<String> aliases = resolveCategoryAliases(category);
        if (aliases.size() == 1) {
            queryWrapper.eq("category", aliases.get(0));
            return;
        }
        queryWrapper.in("category", aliases);
    }

    private List<String> resolveCategoryAliases(String category) {
        String canonical = canonicalCategory(category);
        switch (canonical) {
            case DEFAULT_CATEGORY:
                return List.of(DEFAULT_CATEGORY, "综合交流", "General");
            case "求助答疑":
                return List.of("求助答疑", "Help");
            case "下载反馈":
                return List.of("下载反馈", "Downloads");
            case "建议反馈":
                return List.of("建议反馈", "Suggestions");
            case "问题反馈":
                return List.of("问题反馈", "Bug Report");
            default:
                return List.of(canonical);
        }
    }

    private String canonicalCategory(String category) {
        if (category == null) {
            return DEFAULT_CATEGORY;
        }
        switch (category.trim()) {
            case "General":
            case "综合交流":
            case "综合讨论":
                return DEFAULT_CATEGORY;
            case "Help":
            case "求助答疑":
                return "求助答疑";
            case "Downloads":
            case "下载反馈":
                return "下载反馈";
            case "Suggestions":
            case "建议反馈":
                return "建议反馈";
            case "Bug Report":
            case "问题反馈":
                return "问题反馈";
            default:
                return category.trim();
        }
    }

    private boolean isAllCategory(String category) {
        if (category == null) {
            return false;
        }
        String normalized = category.trim();
        return normalized.isEmpty()
                || "ALL".equalsIgnoreCase(normalized)
                || "\u5168\u90E8".equals(normalized);
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

    private String buildPublicPostCacheKey(int page, int size, String category) {
        String normalizedCategory = category == null ? "ALL" : category;
        return String.format("%d:%d:%s", Math.max(page, 1), Math.max(size, 1), normalizedCategory);
    }

    private List<PostDto> getCachedPublicPostList(String key) {
        TimedPostList cached = publicPostListCache.get(key);
        if (cached == null) {
            return null;
        }
        if (System.currentTimeMillis() - cached.cachedAtMillis > PUBLIC_POST_LIST_CACHE_TTL_MS) {
            publicPostListCache.remove(key, cached);
            return null;
        }
        return cached.posts;
    }

    private PostDto getCachedPublicPostDetail(Long postId) {
        TimedPostDetail cached = publicPostDetailCache.get(postId);
        if (cached == null) {
            return null;
        }
        if (System.currentTimeMillis() - cached.cachedAtMillis > PUBLIC_POST_DETAIL_CACHE_TTL_MS) {
            publicPostDetailCache.remove(postId, cached);
            return null;
        }
        return copyPostDto(cached.post);
    }

    private String buildReplyCacheKey(Long postId, int page, int size) {
        return String.format("%d:%d:%d", postId == null ? 0 : postId, Math.max(page, 1), Math.max(size, 1));
    }

    private List<ReplyDto> getCachedReplyList(String key) {
        TimedReplyList cached = publicReplyListCache.get(key);
        if (cached == null) {
            return null;
        }
        if (System.currentTimeMillis() - cached.cachedAtMillis > PUBLIC_REPLY_LIST_CACHE_TTL_MS) {
            publicReplyListCache.remove(key, cached);
            return null;
        }
        return copyReplyDtos(cached.replies);
    }

    private void cachePublicPostList(String key, List<PostDto> posts) {
        if (posts == null) {
            return;
        }
        if (publicPostListCache.size() >= PUBLIC_POST_LIST_CACHE_MAX_ENTRIES) {
            publicPostListCache.clear();
        }
        publicPostListCache.put(key, new TimedPostList(List.copyOf(posts), System.currentTimeMillis()));
    }

    private void cachePublicPostDetail(Long postId, PostDto dto) {
        if (postId == null || dto == null) {
            return;
        }
        if (publicPostDetailCache.size() >= PUBLIC_POST_DETAIL_CACHE_MAX_ENTRIES) {
            publicPostDetailCache.clear();
        }
        publicPostDetailCache.put(postId, new TimedPostDetail(copyPostDto(dto), System.currentTimeMillis()));
    }

    private void cacheReplyList(String key, List<ReplyDto> replies) {
        if (replies == null) {
            return;
        }
        if (publicReplyListCache.size() >= PUBLIC_REPLY_LIST_CACHE_MAX_ENTRIES) {
            publicReplyListCache.clear();
        }
        publicReplyListCache.put(key, new TimedReplyList(copyReplyDtos(replies), System.currentTimeMillis()));
    }

    private PostDto copyPostDto(PostDto source) {
        if (source == null) {
            return null;
        }
        PostDto copy = new PostDto();
        copy.setId(source.getId());
        copy.setTitle(source.getTitle());
        copy.setContent(source.getContent());
        copy.setCategory(source.getCategory());
        copy.setTags(source.getTags() == null ? Collections.emptyList() : List.copyOf(source.getTags()));
        copy.setUserId(source.getUserId());
        copy.setAuthor(source.getAuthor());
        copy.setAuthorAvatarUrl(source.getAuthorAvatarUrl());
        copy.setAuthorExperience(source.getAuthorExperience());
        copy.setAuthorLevel(source.getAuthorLevel());
        copy.setAuthorTitle(source.getAuthorTitle());
        copy.setCreateTime(source.getCreateTime());
        copy.setUpdateTime(source.getUpdateTime());
        copy.setViewCount(source.getViewCount());
        copy.setLikeCount(source.getLikeCount());
        copy.setFavoriteCount(source.getFavoriteCount());
        copy.setReplyCount(source.getReplyCount());
        copy.setPinned(source.getPinned());
        copy.setLikedByCurrentUser(source.getLikedByCurrentUser());
        copy.setFavoritedByCurrentUser(source.getFavoritedByCurrentUser());
        copy.setCanEdit(source.getCanEdit());
        return copy;
    }

    private List<ReplyDto> copyReplyDtos(List<ReplyDto> source) {
        if (source == null || source.isEmpty()) {
            return Collections.emptyList();
        }
        return source.stream().map(this::copyReplyDto).collect(Collectors.toList());
    }

    private ReplyDto copyReplyDto(ReplyDto source) {
        ReplyDto copy = new ReplyDto();
        copy.setId(source.getId());
        copy.setPostId(source.getPostId());
        copy.setContent(source.getContent());
        copy.setUserId(source.getUserId());
        copy.setAuthor(source.getAuthor());
        copy.setAuthorAvatarUrl(source.getAuthorAvatarUrl());
        copy.setAuthorExperience(source.getAuthorExperience());
        copy.setAuthorLevel(source.getAuthorLevel());
        copy.setAuthorTitle(source.getAuthorTitle());
        copy.setCreateTime(source.getCreateTime());
        return copy;
    }

    private void invalidateForumCaches() {
        publicPostListCache.clear();
        publicPostDetailCache.clear();
        publicReplyListCache.clear();
        leaderboardCache = null;
    }

    private static class ActivityStats {
        private int postCount;
        private int replyCount;
    }

    private static class TimedPostList {
        private final List<PostDto> posts;
        private final long cachedAtMillis;

        private TimedPostList(List<PostDto> posts, long cachedAtMillis) {
            this.posts = posts;
            this.cachedAtMillis = cachedAtMillis;
        }
    }

    private static class TimedPostDetail {
        private final PostDto post;
        private final long cachedAtMillis;

        private TimedPostDetail(PostDto post, long cachedAtMillis) {
            this.post = post;
            this.cachedAtMillis = cachedAtMillis;
        }
    }

    private static class TimedReplyList {
        private final List<ReplyDto> replies;
        private final long cachedAtMillis;

        private TimedReplyList(List<ReplyDto> replies, long cachedAtMillis) {
            this.replies = replies;
            this.cachedAtMillis = cachedAtMillis;
        }
    }

    private static class TimedLeaderboard {
        private final ForumLeaderboardDto value;
        private final long cachedAtMillis;

        private TimedLeaderboard(ForumLeaderboardDto value, long cachedAtMillis) {
            this.value = value;
            this.cachedAtMillis = cachedAtMillis;
        }
    }
}
