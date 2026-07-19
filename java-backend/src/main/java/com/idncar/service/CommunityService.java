package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.PostReportMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.ChatPresenceModeDto;
import com.idncar.model.dto.ChatRoomMessageDto;
import com.idncar.model.dto.CommunityTalkCommentDto;
import com.idncar.model.dto.CommunityTalkPostDto;
import com.idncar.model.dto.CreateChatMessageRequest;
import com.idncar.model.dto.CreateCommunityTalkCommentRequest;
import com.idncar.model.dto.CreateCommunityTalkPostRequest;
import com.idncar.model.dto.CreateCommunityReportRequest;
import com.idncar.model.dto.CreatePrivateChatMessageRequest;
import com.idncar.model.dto.PrivateChatMessageDto;
import com.idncar.model.dto.PrivateChatUserDto;
import com.idncar.model.dto.UpdateChatPresenceModeRequest;
import com.idncar.model.entity.User;
import com.idncar.model.entity.PostReport;
import com.idncar.util.RichContentValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class CommunityService {

    private static final String DEFAULT_TALK_CATEGORY = "闲聊";
    private static final String VISIBILITY_ONLINE = "ONLINE";
    private static final String VISIBILITY_INVISIBLE = "INVISIBLE";
    private static final List<String> REPORT_TARGET_TYPES = List.of("CHAT_MESSAGE", "TALK_POST");
    private static final int CHAT_MESSAGES_PER_MINUTE = 30;
    private static final int CHAT_IMAGES_PER_MINUTE = 10;
    private static final int PRIVATE_MESSAGES_PER_MINUTE = 30;
    private static final int TALK_POSTS_PER_MINUTE = 5;
    private static final int TALK_COMMENTS_PER_MINUTE = 20;
    private static final int REPORTS_PER_MINUTE = 5;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PostReportMapper postReportMapper;

    @Autowired
    private NotificationService notificationService;

    private final RowMapper<ChatRoomMessageDto> chatMessageRowMapper = (rs, rowNum) -> new ChatRoomMessageDto(
            rs.getLong("id"),
            rs.getString("room_id"),
            rs.getString("author"),
            defaultIfBlank(rs.getString("avatar_seed"), rs.getString("author")),
            rs.getString("content"),
            timestampToMillis(rs.getTimestamp("create_time"))
    );

    private final RowMapper<PrivateChatMessageDto> privateChatMessageRowMapper = (rs, rowNum) -> new PrivateChatMessageDto(
            rs.getLong("id"),
            rs.getLong("sender_id"),
            defaultIfBlank(rs.getString("sender_nickname"), "用户"),
            rs.getString("sender_avatar_url"),
            rs.getLong("recipient_id"),
            rs.getString("content"),
            timestampToMillis(rs.getTimestamp("create_time"))
    );

    private final RowMapper<CommunityTalkPostDto> talkPostRowMapper = (rs, rowNum) -> new CommunityTalkPostDto(
            rs.getLong("id"),
            rs.getString("author"),
            defaultIfBlank(rs.getString("avatar_seed"), rs.getString("author")),
            rs.getString("content"),
            rs.getString("category"),
            timestampToMillis(rs.getTimestamp("create_time")),
            rs.getInt("likes"),
            rs.getBoolean("pinned"),
            List.of()
    );

    private final RowMapper<CommunityTalkCommentDto> talkCommentRowMapper = (rs, rowNum) -> new CommunityTalkCommentDto(
            rs.getLong("id"),
            rs.getLong("post_id"),
            rs.getString("author"),
            rs.getString("content"),
            timestampToMillis(rs.getTimestamp("create_time"))
    );

    public List<ChatRoomMessageDto> getChatMessages(String roomId) {
        return getChatMessages(roomId, null);
    }

    public List<ChatRoomMessageDto> getChatMessages(String roomId, Long beforeId) {
        String safeRoomId = requireRoomId(roomId);
        long cursor = pageCursor(beforeId);
        return jdbcTemplate.query(
                """
                SELECT id, room_id, author, avatar_seed, content, create_time
                FROM (
                    SELECT id, room_id, author, avatar_seed, content, create_time
                    FROM community_chat_messages
                    WHERE room_id = ? AND id < ?
                    ORDER BY id DESC
                    LIMIT 50
                ) recent
                ORDER BY id ASC
                """,
                chatMessageRowMapper,
                safeRoomId,
                cursor
        );
    }

    @Transactional(rollbackFor = Exception.class)
    public ChatRoomMessageDto createChatMessage(Long currentUserId, CreateChatMessageRequest request) {
        User currentUser = userAccessService.requireActiveUser(currentUserId);
        String roomId = requireRoomId(request.roomId());
        String author = displayName(currentUser);
        String avatarSeed = author;
        String content = RichContentValidator.requireSafeImageMarkupUrls(limitText(requireText(request.content(), "消息内容不能为空"), 500));
        requireWriteLimit(currentUserId, "chat-message", CHAT_MESSAGES_PER_MINUTE);
        Date now = Date.from(Instant.now());

        long id = insertAndReturnKey(
                """
                INSERT INTO community_chat_messages (author_id, room_id, author, avatar_seed, content, create_time)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                currentUser.getId(),
                roomId,
                author,
                avatarSeed,
                content,
                now
        );

        return new ChatRoomMessageDto(id, roomId, author, avatarSeed, content, now.getTime());
    }

    public void requireChatImageUploadAllowed(Long currentUserId) {
        userAccessService.requireActiveUser(currentUserId);
        requireWriteLimit(currentUserId, "chat-image", CHAT_IMAGES_PER_MINUTE);
    }

    @Transactional(rollbackFor = Exception.class)
    public void clearChatMessages(Long currentUserId, String roomId) {
        userAccessService.requireAdmin(currentUserId);
        jdbcTemplate.update(
                "DELETE FROM community_chat_messages WHERE room_id = ?",
                requireRoomId(roomId)
        );
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean deleteReportedContent(Long adminUserId, String targetType, Long targetId) {
        userAccessService.requireAdmin(adminUserId);
        if (targetId == null || targetId <= 0) {
            throw ApiException.badRequest("举报目标无效");
        }
        if ("CHAT_MESSAGE".equals(targetType)) {
            return jdbcTemplate.update("DELETE FROM community_chat_messages WHERE id = ?", targetId) > 0;
        }
        if ("TALK_POST".equals(targetType)) {
            jdbcTemplate.update("DELETE FROM community_talk_comments WHERE post_id = ?", targetId);
            return jdbcTemplate.update("DELETE FROM community_talk_posts WHERE id = ?", targetId) > 0;
        }
        throw ApiException.badRequest("该举报类型不支持直接删除内容");
    }

    public List<PrivateChatUserDto> getPrivateChatUsers(Long currentUserId) {
        userAccessService.requireActiveUser(currentUserId);

        List<PrivateChatUserDto> users = jdbcTemplate.query(
                """
                SELECT u.id, u.nickname, u.avatar_url, u.bio,
                       COALESCE(u.chat_visibility, 'ONLINE') AS chat_visibility,
                       b.blocker_id IS NOT NULL AS blocked,
                       COUNT(CASE WHEN m.recipient_id = ? AND m.read_at IS NULL THEN 1 END) AS unread_count,
                       MAX(m.create_time) AS last_message_at
                FROM users u
                LEFT JOIN community_user_blocks b ON b.blocker_id = ? AND b.blocked_id = u.id
                LEFT JOIN private_chat_messages m
                  ON (m.sender_id = u.id AND m.recipient_id = ?)
                  OR (m.sender_id = ? AND m.recipient_id = u.id)
                WHERE u.status = 'ACTIVE' AND u.id <> ?
                GROUP BY u.id, u.nickname, u.avatar_url, u.bio, u.chat_visibility, b.blocker_id
                ORDER BY last_message_at DESC, u.nickname ASC, u.id ASC
                """,
                (rs, rowNum) -> {
                    Long userId = rs.getLong("id");
                    Timestamp lastMessageAt = rs.getTimestamp("last_message_at");
                    boolean hasConversation = lastMessageAt != null;
                    boolean online = isUserOnline(userId);
                    String visibility = normalizePresenceMode(rs.getString("chat_visibility"), false);
                    if (!hasConversation && (!online || VISIBILITY_INVISIBLE.equals(visibility))) {
                        return null;
                    }

                    return new PrivateChatUserDto(
                            userId,
                            defaultIfBlank(rs.getString("nickname"), "用户"),
                            rs.getString("avatar_url"),
                            rs.getString("bio"),
                            online && !VISIBILITY_INVISIBLE.equals(visibility),
                            rs.getBoolean("blocked"),
                            rs.getLong("unread_count"),
                            lastMessageAt == null ? null : lastMessageAt.getTime()
                    );
                },
                currentUserId,
                currentUserId,
                currentUserId,
                currentUserId,
                currentUserId
        );

        return users.stream().filter(Objects::nonNull).toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public List<PrivateChatMessageDto> getPrivateMessages(Long currentUserId, Long targetUserId, Long beforeId) {
        userAccessService.requireActiveUser(currentUserId);
        Long safeTargetUserId = requirePrivateTarget(currentUserId, targetUserId);
        long cursor = pageCursor(beforeId);

        jdbcTemplate.update(
                "UPDATE private_chat_messages SET read_at = CURRENT_TIMESTAMP WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL",
                safeTargetUserId,
                currentUserId
        );

        List<PrivateChatMessageDto> messages = jdbcTemplate.query(
                """
                SELECT m.id,
                       m.sender_id,
                       m.recipient_id,
                       m.content,
                       m.create_time,
                       u.nickname AS sender_nickname,
                       u.avatar_url AS sender_avatar_url
                FROM private_chat_messages m
                LEFT JOIN users u ON u.id = m.sender_id
                WHERE ((m.sender_id = ? AND m.recipient_id = ?)
                   OR (m.sender_id = ? AND m.recipient_id = ?))
                  AND m.id < ?
                ORDER BY m.id DESC
                LIMIT 50
                """,
                privateChatMessageRowMapper,
                currentUserId,
                safeTargetUserId,
                safeTargetUserId,
                currentUserId,
                cursor
        );
        Collections.reverse(messages);
        return messages;
    }

    public List<PrivateChatMessageDto> getPrivateMessages(Long currentUserId, Long targetUserId) {
        return getPrivateMessages(currentUserId, targetUserId, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public PrivateChatMessageDto createPrivateMessage(Long currentUserId, CreatePrivateChatMessageRequest request) {
        User sender = userAccessService.requireActiveUser(currentUserId);
        Long recipientUserId = requirePrivateTarget(currentUserId, request.recipientUserId());
        if (hasPrivateChatBlock(currentUserId, recipientUserId)) {
            throw ApiException.forbidden("你们之间已启用屏蔽，无法发送消息");
        }
        String content = RichContentValidator.requireSafeImageMarkupUrls(limitText(requireText(request.content(), "消息内容不能为空"), 1000));
        requireWriteLimit(currentUserId, "private-message", PRIVATE_MESSAGES_PER_MINUTE);
        Date now = Date.from(Instant.now());

        long id = insertAndReturnKey(
                """
                INSERT INTO private_chat_messages (sender_id, recipient_id, content, create_time)
                VALUES (?, ?, ?, ?)
                """,
                sender.getId(),
                recipientUserId,
                content,
                now
        );

        return new PrivateChatMessageDto(
                id,
                sender.getId(),
                defaultIfBlank(sender.getNickname(), "用户"),
                sender.getAvatarUrl(),
                recipientUserId,
                content,
                now.getTime()
        );
    }

    @Transactional(rollbackFor = Exception.class)
    public void blockPrivateChatUser(Long currentUserId, Long targetUserId) {
        userAccessService.requireActiveUser(currentUserId);
        Long safeTargetUserId = requirePrivateTarget(currentUserId, targetUserId);
        jdbcTemplate.update(
                "INSERT IGNORE INTO community_user_blocks (blocker_id, blocked_id, create_time) VALUES (?, ?, CURRENT_TIMESTAMP)",
                currentUserId,
                safeTargetUserId
        );
    }

    @Transactional(rollbackFor = Exception.class)
    public void unblockPrivateChatUser(Long currentUserId, Long targetUserId) {
        userAccessService.requireActiveUser(currentUserId);
        Long safeTargetUserId = requirePrivateTarget(currentUserId, targetUserId);
        jdbcTemplate.update(
                "DELETE FROM community_user_blocks WHERE blocker_id = ? AND blocked_id = ?",
                currentUserId,
                safeTargetUserId
        );
    }

    @Transactional(rollbackFor = Exception.class)
    public void reportCommunityContent(Long currentUserId, CreateCommunityReportRequest request) {
        User reporter = userAccessService.requireActiveUser(currentUserId);
        String targetType = requireText(request.targetType(), "举报类型不能为空").toUpperCase(Locale.ROOT);
        if (!REPORT_TARGET_TYPES.contains(targetType)) {
            throw ApiException.badRequest("举报类型无效");
        }
        Long targetId = request.targetId();
        if (targetId == null || targetId <= 0) {
            throw ApiException.badRequest("举报目标无效");
        }

        Map<String, Object> target = loadReportTarget(targetType, targetId);
        Long authorId = toLong(target.get("author_id"));
        if (Objects.equals(authorId, reporter.getId())) {
            throw ApiException.badRequest("不能举报自己发布的内容");
        }

        Long existingCount = postReportMapper.selectCount(new QueryWrapper<PostReport>()
                .eq("target_type", targetType)
                .eq("target_id", targetId)
                .eq("reporter_id", currentUserId)
                .eq("status", "PENDING"));
        if (existingCount != null && existingCount > 0) {
            throw ApiException.badRequest("你已经举报过这条内容");
        }

        String reason = limitText(requireText(request.reason(), "举报原因不能为空"), 60);
        requireWriteLimit(currentUserId, "report", REPORTS_PER_MINUTE);
        PostReport report = new PostReport();
        report.setTargetType(targetType);
        report.setTargetId(targetId);
        report.setTargetSummary(limitText(buildReportTargetSummary(targetType, target), 240));
        report.setReporterId(currentUserId);
        report.setReason(reason);
        report.setDetail(limitText(normalizeNullableText(request.detail()), 500));
        report.setStatus("PENDING");
        report.setCreateTime(new Date());
        report.setUpdateTime(new Date());
        postReportMapper.insert(report);

        List<Long> managerIds = userMapper.selectList(new QueryWrapper<User>()
                        .eq("status", "ACTIVE")
                        .in("role", List.of("OWNER", "ADMIN")))
                .stream()
                .map(User::getId)
                .toList();
        notificationService.createNotifications(
                managerIds,
                "COMMUNITY_REPORT",
                "有新的社区举报待处理",
                report.getTargetSummary(),
                "/admin#reports"
        );
    }

    public ChatPresenceModeDto getChatPresenceMode(Long currentUserId) {
        User user = userAccessService.requireActiveUser(currentUserId);
        return new ChatPresenceModeDto(normalizePresenceMode(user.getChatVisibility(), false));
    }

    @Transactional(rollbackFor = Exception.class)
    public ChatPresenceModeDto updateChatPresenceMode(Long currentUserId, UpdateChatPresenceModeRequest request) {
        User user = userAccessService.requireActiveUser(currentUserId);
        String mode = normalizePresenceMode(request.mode(), true);
        user.setChatVisibility(mode);
        userMapper.updateById(user);
        return new ChatPresenceModeDto(mode);
    }

    public List<CommunityTalkPostDto> getTalkPosts(Long beforeId) {
        long cursor = pageCursor(beforeId);
        List<CommunityTalkPostDto> posts = jdbcTemplate.query(
                """
                SELECT id, author, avatar_seed, content, category, likes, pinned, create_time
                FROM community_talk_posts
                WHERE id < ?
                ORDER BY id DESC
                LIMIT 50
                """,
                talkPostRowMapper,
                cursor
        );

        if (posts.isEmpty()) {
            return List.of();
        }

        Map<Long, List<CommunityTalkCommentDto>> commentsByPostId = loadTalkCommentsByPostIds(
                posts.stream().map(CommunityTalkPostDto::id).filter(Objects::nonNull).toList()
        );

        return posts.stream()
                .map(post -> post.withComments(commentsByPostId.getOrDefault(post.id(), List.of())))
                .collect(Collectors.toList());
    }

    public List<CommunityTalkPostDto> getTalkPosts() {
        return getTalkPosts(null);
    }

    @Transactional(rollbackFor = Exception.class)
    public CommunityTalkPostDto createTalkPost(Long currentUserId, CreateCommunityTalkPostRequest request) {
        User currentUser = userAccessService.requireActiveUser(currentUserId);
        String author = displayName(currentUser);
        String avatarSeed = author;
        String content = limitText(requireText(request.content(), "帖子内容不能为空"), 500);
        String category = limitText(defaultIfBlank(normalizeNullableText(request.category()), DEFAULT_TALK_CATEGORY), 40);
        requireWriteLimit(currentUserId, "talk-post", TALK_POSTS_PER_MINUTE);
        Date now = Date.from(Instant.now());

        long id = insertAndReturnKey(
                """
                INSERT INTO community_talk_posts (author_id, author, avatar_seed, content, category, likes, pinned, create_time, update_time)
                VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
                """,
                currentUser.getId(),
                author,
                avatarSeed,
                content,
                category,
                now,
                now
        );

        return new CommunityTalkPostDto(id, author, avatarSeed, content, category, now.getTime(), 0, false, List.of());
    }

    @Transactional(rollbackFor = Exception.class)
    public CommunityTalkPostDto likeTalkPost(Long currentUserId, Long postId) {
        userAccessService.requireActiveUser(currentUserId);
        requireTalkPost(postId);
        jdbcTemplate.update(
                """
                UPDATE community_talk_posts
                SET likes = COALESCE(likes, 0) + 1,
                    update_time = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                postId
        );
        return getTalkPost(postId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteTalkPost(Long currentUserId, Long postId) {
        User currentUser = userAccessService.requireActiveUser(currentUserId);
        requireTalkPost(postId);
        Long authorId = jdbcTemplate.query(
                "SELECT author_id FROM community_talk_posts WHERE id = ?",
                (rs, rowNum) -> rs.getObject("author_id", Long.class),
                postId
        ).stream().findFirst().orElse(null);
        if (!Objects.equals(authorId, currentUser.getId()) && !userAccessService.isAdminRole(currentUser.getRole())) {
            throw ApiException.forbidden("只能删除自己发布的帖子");
        }

        jdbcTemplate.update("DELETE FROM community_talk_comments WHERE post_id = ?", postId);
        jdbcTemplate.update("DELETE FROM community_talk_posts WHERE id = ?", postId);
    }

    @Transactional(rollbackFor = Exception.class)
    public CommunityTalkCommentDto createTalkComment(Long currentUserId, Long postId, CreateCommunityTalkCommentRequest request) {
        User currentUser = userAccessService.requireActiveUser(currentUserId);
        requireTalkPost(postId);
        String author = displayName(currentUser);
        String content = limitText(requireText(request.content(), "评论内容不能为空"), 300);
        requireWriteLimit(currentUserId, "talk-comment", TALK_COMMENTS_PER_MINUTE);
        Date now = Date.from(Instant.now());

        long id = insertAndReturnKey(
                """
                INSERT INTO community_talk_comments (post_id, author, content, create_time)
                VALUES (?, ?, ?, ?)
                """,
                postId,
                author,
                content,
                now
        );

        jdbcTemplate.update(
                """
                UPDATE community_talk_posts
                SET update_time = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                postId
        );

        return new CommunityTalkCommentDto(id, postId, author, content, now.getTime());
    }

    private Long requirePrivateTarget(Long currentUserId, Long targetUserId) {
        if (targetUserId == null || targetUserId <= 0) {
            throw ApiException.badRequest("目标用户不能为空");
        }
        if (Objects.equals(currentUserId, targetUserId)) {
            throw ApiException.badRequest("不能给自己发送私信");
        }
        userAccessService.requireActiveUser(targetUserId);
        return targetUserId;
    }

    private boolean hasPrivateChatBlock(Long currentUserId, Long targetUserId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM community_user_blocks
                WHERE (blocker_id = ? AND blocked_id = ?)
                   OR (blocker_id = ? AND blocked_id = ?)
                """,
                Integer.class,
                currentUserId,
                targetUserId,
                targetUserId,
                currentUserId
        );
        return count != null && count > 0;
    }

    private CommunityTalkPostDto getTalkPost(Long postId) {
        CommunityTalkPostDto post = requireTalkPost(postId);
        Map<Long, List<CommunityTalkCommentDto>> commentsByPostId = loadTalkCommentsByPostIds(List.of(postId));
        return post.withComments(commentsByPostId.getOrDefault(postId, List.of()));
    }

    private Map<String, Object> loadReportTarget(String targetType, Long targetId) {
        String sql = "CHAT_MESSAGE".equals(targetType)
                ? "SELECT author_id, author, content FROM community_chat_messages WHERE id = ?"
                : "SELECT author_id, author, content FROM community_talk_posts WHERE id = ?";
        return jdbcTemplate.queryForList(sql, targetId).stream()
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("举报内容不存在"));
    }

    private String buildReportTargetSummary(String targetType, Map<String, Object> target) {
        String label = "CHAT_MESSAGE".equals(targetType) ? "群聊消息" : "随便聊聊";
        return label + " · " + defaultIfBlank((String) target.get("author"), "用户") + "："
                + defaultIfBlank(normalizeNullableText((String) target.get("content")), "无内容");
    }

    private Long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private CommunityTalkPostDto requireTalkPost(Long postId) {
        if (postId == null || postId <= 0) {
            throw ApiException.badRequest("帖子编号无效");
        }

        return jdbcTemplate.query(
                        """
                        SELECT id, author, avatar_seed, content, category, likes, pinned, create_time
                        FROM community_talk_posts
                        WHERE id = ?
                        LIMIT 1
                        """,
                        talkPostRowMapper,
                        postId
                ).stream()
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("帖子不存在"));
    }

    private Map<Long, List<CommunityTalkCommentDto>> loadTalkCommentsByPostIds(List<Long> postIds) {
        if (postIds == null || postIds.isEmpty()) {
            return Collections.emptyMap();
        }

        String placeholders = postIds.stream().map(id -> "?").collect(Collectors.joining(","));
        List<CommunityTalkCommentDto> comments = jdbcTemplate.query(
                """
                SELECT id, post_id, author, content, create_time
                FROM community_talk_comments
                WHERE post_id IN (%s)
                ORDER BY create_time DESC, id DESC
                """.formatted(placeholders),
                talkCommentRowMapper,
                postIds.toArray()
        );

        return comments.stream().collect(Collectors.groupingBy(
                CommunityTalkCommentDto::postId,
                LinkedHashMap::new,
                Collectors.toList()
        ));
    }

    private long insertAndReturnKey(String sql, Object... args) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int index = 0; index < args.length; index++) {
                Object arg = args[index];
                if (arg instanceof Date date) {
                    statement.setTimestamp(index + 1, new Timestamp(date.getTime()));
                } else {
                    statement.setObject(index + 1, arg);
                }
            }
            return statement;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw ApiException.badRequest("创建记录失败");
        }
        return key.longValue();
    }

    private long pageCursor(Long beforeId) {
        if (beforeId != null && beforeId <= 0) {
            throw ApiException.badRequest("分页游标无效");
        }
        return beforeId == null ? Long.MAX_VALUE : beforeId;
    }

    private boolean isUserOnline(Long userId) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey("token:" + userId));
        } catch (Exception ignored) {
            return false;
        }
    }

    private void requireWriteLimit(Long userId, String action, int limit) {
        // ponytail: fixed windows allow boundary bursts; use a sliding-window script only if that becomes measurable.
        String key = "community:rate:" + action + ":" + userId + ":" + Instant.now().getEpochSecond() / 60;
        Long count = redisTemplate.opsForValue().increment(key);
        redisTemplate.expire(key, 2, TimeUnit.MINUTES);
        if (count == null) {
            throw new IllegalStateException("Redis did not return a community rate-limit counter");
        }
        if (count > limit) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "操作过于频繁，请稍后再试");
        }
    }

    private long timestampToMillis(Timestamp timestamp) {
        return timestamp == null ? 0L : timestamp.getTime();
    }

    private String requireRoomId(String roomId) {
        return limitText(requireText(roomId, "房间编号不能为空"), 32);
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

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String displayName(User user) {
        return limitText(defaultIfBlank(normalizeNullableText(user.getNickname()), user.getUsername()), 40);
    }

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private String normalizePresenceMode(String mode, boolean strict) {
        String normalized = normalizeNullableText(mode);
        if (normalized == null) {
            return VISIBILITY_ONLINE;
        }

        String upper = normalized.toUpperCase(Locale.ROOT);
        if (VISIBILITY_ONLINE.equals(upper) || VISIBILITY_INVISIBLE.equals(upper)) {
            return upper;
        }

        if (strict) {
            throw ApiException.badRequest("在线状态取值无效");
        }
        return VISIBILITY_ONLINE;
    }
}
