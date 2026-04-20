package com.idncar.service.impl;

import com.idncar.exception.ApiException;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.ChatPresenceModeDto;
import com.idncar.model.dto.ChatRoomMessageDto;
import com.idncar.model.dto.CommunityTalkCommentDto;
import com.idncar.model.dto.CommunityTalkPostDto;
import com.idncar.model.dto.CreateChatMessageRequest;
import com.idncar.model.dto.CreateCommunityTalkCommentRequest;
import com.idncar.model.dto.CreateCommunityTalkPostRequest;
import com.idncar.model.dto.CreatePrivateChatMessageRequest;
import com.idncar.model.dto.PrivateChatMessageDto;
import com.idncar.model.dto.PrivateChatUserDto;
import com.idncar.model.dto.UpdateChatPresenceModeRequest;
import com.idncar.model.entity.User;
import com.idncar.service.CommunityService;
import com.idncar.service.UserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
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
import java.util.stream.Collectors;

@Service
public class CommunityServiceImpl implements CommunityService {

    private static final String DEFAULT_CHAT_AUTHOR = "Anonymous";
    private static final String DEFAULT_TALK_AUTHOR = "Anonymous";
    private static final String DEFAULT_TALK_CATEGORY = "Chat";
    private static final String VISIBILITY_ONLINE = "ONLINE";
    private static final String VISIBILITY_INVISIBLE = "INVISIBLE";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private UserMapper userMapper;

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
            defaultIfBlank(rs.getString("sender_nickname"), "User"),
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

    @Override
    public List<ChatRoomMessageDto> getChatMessages(String roomId) {
        return jdbcTemplate.query(
                """
                SELECT id, room_id, author, avatar_seed, content, create_time
                FROM community_chat_messages
                WHERE room_id = ?
                ORDER BY create_time ASC, id ASC
                """,
                chatMessageRowMapper,
                requireRoomId(roomId)
        );
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ChatRoomMessageDto createChatMessage(CreateChatMessageRequest request) {
        String roomId = requireRoomId(request.roomId());
        String author = limitText(defaultIfBlank(normalizeNullableText(request.author()), DEFAULT_CHAT_AUTHOR), 40);
        String avatarSeed = limitText(defaultIfBlank(normalizeNullableText(request.avatarSeed()), author), 60);
        String content = limitText(requireText(request.content(), "Message content is required"), 500);
        Date now = Date.from(Instant.now());

        long id = insertAndReturnKey(
                """
                INSERT INTO community_chat_messages (room_id, author, avatar_seed, content, create_time)
                VALUES (?, ?, ?, ?, ?)
                """,
                roomId,
                author,
                avatarSeed,
                content,
                now
        );

        return new ChatRoomMessageDto(id, roomId, author, avatarSeed, content, now.getTime());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void clearChatMessages(String roomId) {
        jdbcTemplate.update(
                "DELETE FROM community_chat_messages WHERE room_id = ?",
                requireRoomId(roomId)
        );
    }

    @Override
    public List<PrivateChatUserDto> getOnlinePrivateChatUsers(Long currentUserId) {
        userAccessService.requireActiveUser(currentUserId);

        List<PrivateChatUserDto> users = jdbcTemplate.query(
                """
                SELECT id, nickname, avatar_url, bio, COALESCE(chat_visibility, 'ONLINE') AS chat_visibility
                FROM users
                WHERE status = 'ACTIVE'
                ORDER BY nickname ASC, id ASC
                """,
                (rs, rowNum) -> {
                    Long userId = rs.getLong("id");
                    if (Objects.equals(userId, currentUserId)) {
                        return null;
                    }

                    if (!isUserOnline(userId)) {
                        return null;
                    }

                    String visibility = normalizePresenceMode(rs.getString("chat_visibility"), false);
                    if (VISIBILITY_INVISIBLE.equals(visibility)) {
                        return null;
                    }

                    return new PrivateChatUserDto(
                            userId,
                            defaultIfBlank(rs.getString("nickname"), "User"),
                            rs.getString("avatar_url"),
                            rs.getString("bio"),
                            true
                    );
                }
        );

        return users.stream().filter(Objects::nonNull).toList();
    }

    @Override
    public List<PrivateChatMessageDto> getPrivateMessages(Long currentUserId, Long targetUserId) {
        userAccessService.requireActiveUser(currentUserId);
        Long safeTargetUserId = requirePrivateTarget(currentUserId, targetUserId);

        return jdbcTemplate.query(
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
                WHERE (m.sender_id = ? AND m.recipient_id = ?)
                   OR (m.sender_id = ? AND m.recipient_id = ?)
                ORDER BY m.create_time ASC, m.id ASC
                """,
                privateChatMessageRowMapper,
                currentUserId,
                safeTargetUserId,
                safeTargetUserId,
                currentUserId
        );
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PrivateChatMessageDto createPrivateMessage(Long currentUserId, CreatePrivateChatMessageRequest request) {
        User sender = userAccessService.requireActiveUser(currentUserId);
        Long recipientUserId = requirePrivateTarget(currentUserId, request.recipientUserId());
        String content = limitText(requireText(request.content(), "Message content is required"), 1000);
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
                defaultIfBlank(sender.getNickname(), "User"),
                sender.getAvatarUrl(),
                recipientUserId,
                content,
                now.getTime()
        );
    }

    @Override
    public ChatPresenceModeDto getChatPresenceMode(Long currentUserId) {
        User user = userAccessService.requireActiveUser(currentUserId);
        return new ChatPresenceModeDto(normalizePresenceMode(user.getChatVisibility(), false));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ChatPresenceModeDto updateChatPresenceMode(Long currentUserId, UpdateChatPresenceModeRequest request) {
        User user = userAccessService.requireActiveUser(currentUserId);
        String mode = normalizePresenceMode(request.mode(), true);
        user.setChatVisibility(mode);
        userMapper.updateById(user);
        return new ChatPresenceModeDto(mode);
    }

    @Override
    public List<CommunityTalkPostDto> getTalkPosts() {
        List<CommunityTalkPostDto> posts = jdbcTemplate.query(
                """
                SELECT id, author, avatar_seed, content, category, likes, pinned, create_time
                FROM community_talk_posts
                ORDER BY pinned DESC, create_time DESC, id DESC
                """,
                talkPostRowMapper
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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CommunityTalkPostDto createTalkPost(CreateCommunityTalkPostRequest request) {
        String author = limitText(defaultIfBlank(normalizeNullableText(request.author()), DEFAULT_TALK_AUTHOR), 40);
        String avatarSeed = limitText(defaultIfBlank(normalizeNullableText(request.avatarSeed()), author), 60);
        String content = limitText(requireText(request.content(), "Post content is required"), 500);
        String category = limitText(defaultIfBlank(normalizeNullableText(request.category()), DEFAULT_TALK_CATEGORY), 40);
        Date now = Date.from(Instant.now());

        long id = insertAndReturnKey(
                """
                INSERT INTO community_talk_posts (author, avatar_seed, content, category, likes, pinned, create_time, update_time)
                VALUES (?, ?, ?, ?, 0, 0, ?, ?)
                """,
                author,
                avatarSeed,
                content,
                category,
                now,
                now
        );

        return new CommunityTalkPostDto(id, author, avatarSeed, content, category, now.getTime(), 0, false, List.of());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CommunityTalkPostDto likeTalkPost(Long postId) {
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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteTalkPost(Long postId, String author) {
        CommunityTalkPostDto post = requireTalkPost(postId);
        String normalizedAuthor = requireText(author, "Author is required");
        if (!Objects.equals(post.author(), normalizedAuthor)) {
            throw ApiException.forbidden("You can only delete your own post");
        }

        jdbcTemplate.update("DELETE FROM community_talk_comments WHERE post_id = ?", postId);
        jdbcTemplate.update("DELETE FROM community_talk_posts WHERE id = ?", postId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CommunityTalkCommentDto createTalkComment(Long postId, CreateCommunityTalkCommentRequest request) {
        requireTalkPost(postId);
        String author = limitText(defaultIfBlank(normalizeNullableText(request.author()), DEFAULT_TALK_AUTHOR), 40);
        String content = limitText(requireText(request.content(), "Comment content is required"), 300);
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
            throw ApiException.badRequest("Target user is required");
        }
        if (Objects.equals(currentUserId, targetUserId)) {
            throw ApiException.badRequest("You cannot send a private message to yourself");
        }
        userAccessService.requireActiveUser(targetUserId);
        return targetUserId;
    }

    private CommunityTalkPostDto getTalkPost(Long postId) {
        CommunityTalkPostDto post = requireTalkPost(postId);
        Map<Long, List<CommunityTalkCommentDto>> commentsByPostId = loadTalkCommentsByPostIds(List.of(postId));
        return post.withComments(commentsByPostId.getOrDefault(postId, List.of()));
    }

    private CommunityTalkPostDto requireTalkPost(Long postId) {
        if (postId == null || postId <= 0) {
            throw ApiException.badRequest("Post id is invalid");
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
                .orElseThrow(() -> ApiException.notFound("Post does not exist"));
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
            throw ApiException.badRequest("Failed to create record");
        }
        return key.longValue();
    }

    private boolean isUserOnline(Long userId) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey("token:" + userId));
        } catch (Exception ignored) {
            return false;
        }
    }

    private long timestampToMillis(Timestamp timestamp) {
        return timestamp == null ? 0L : timestamp.getTime();
    }

    private String requireRoomId(String roomId) {
        return limitText(requireText(roomId, "Room id is required"), 32);
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
            throw ApiException.badRequest("Invalid visibility mode");
        }
        return VISIBILITY_ONLINE;
    }
}
