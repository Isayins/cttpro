package com.idncar.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.exception.ApiException;
import com.idncar.model.dto.CreateRpsTableRequest;
import com.idncar.model.dto.JoinRpsTableRequest;
import com.idncar.model.dto.RpsJoinRequestDto;
import com.idncar.model.dto.RpsLobbyTableDto;
import com.idncar.model.dto.RpsPlayerDto;
import com.idncar.model.dto.RpsRoundSummaryDto;
import com.idncar.model.dto.RpsScoreDto;
import com.idncar.model.dto.RpsTableResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Service
public class RockPaperScissorsService {

    private static final String TABLE_KEY_PREFIX = "rps:table:";
    private static final String TABLE_INDEX_KEY = "rps:tables:index";
    private static final String ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final long TABLE_TTL_SECONDS = 2 * 60 * 60;
    private static final int MAX_HISTORY_SIZE = 6;
    private static final List<IdentityValue> IDENTITIES = List.of(
            new IdentityValue("✦", "流星", "划过夜空的信使"),
            new IdentityValue("◒", "月亮", "安静观察潮汐"),
            new IdentityValue("⌁", "海浪", "总会找到出口"),
            new IdentityValue("△", "山峰", "把视野抬得更高"),
            new IdentityValue("✧", "灯塔", "为远方留一盏灯"),
            new IdentityValue("➹", "纸飞机", "把想法投向远方"),
            new IdentityValue("◈", "唱片", "记住每一段旋律"),
            new IdentityValue("⌂", "小屋", "给旅程一个落脚点")
    );

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${app.rps.reveal-delay-ms:3000}")
    private long revealDelayMs = 3000L;

    private final SecureRandom secureRandom = new SecureRandom();
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Map<String, StoredTable> localTables = new ConcurrentHashMap<>();
    private final Map<String, Object> tableLocks = new ConcurrentHashMap<>();
    private final Set<String> activeTableCodes = ConcurrentHashMap.newKeySet();

    public RpsTableResponse createTable(CreateRpsTableRequest request) {
        String name = normalizeName(request == null ? null : request.name());
        String accessMode = normalizeAccessMode(request == null ? null : request.accessMode());
        String passwordHash = createPasswordHash(accessMode, request == null ? null : request.password());
        for (int attempt = 0; attempt < 20; attempt++) {
            String code = generateRoomCode();
            if (loadTable(code) != null) {
                continue;
            }

            String playerToken = UUID.randomUUID().toString();
            IdentityValue identity = randomIdentity(null);
            StoredTable table = new StoredTable();
            table.code = code;
            table.round = 1;
            table.phase = "WAITING";
            table.createdAtEpochMs = now();
            table.accessMode = accessMode;
            table.passwordHash = passwordHash;
            table.playerOneToken = playerToken;
            table.playerOneName = name;
            table.playerOneIdentity = identity;
            table.history = new ArrayList<>();
            table.joinRequests = new ArrayList<>();
            saveTable(table);
            return buildResponseWithToken(table, playerToken);
        }
        throw ApiException.badGateway("暂时无法创建猜拳桌，请稍后重试");
    }

    public List<RpsLobbyTableDto> listTables() {
        Set<String> codes = new HashSet<>(activeTableCodes);
        try {
            Set<Object> redisCodes = redisTemplate.opsForSet().members(TABLE_INDEX_KEY);
            if (redisCodes != null) {
                redisCodes.forEach(value -> codes.add(String.valueOf(value)));
            }
        } catch (Exception ignored) {
            // The local index keeps a single backend instance usable when Redis is unavailable.
        }

        List<RpsLobbyTableDto> tables = new ArrayList<>();
        for (String code : codes) {
            StoredTable table = loadTable(code);
            if (table == null) {
                activeTableCodes.remove(code);
                continue;
            }
            ensureDefaults(table);
            if (table.playerTwoToken != null) {
                continue;
            }
            tables.add(new RpsLobbyTableDto(
                    table.code,
                    table.playerOneName,
                    table.accessMode,
                    viewPhase(table, now()),
                    joinedPlayers(table),
                    hasPendingRequests(table),
                    table.createdAtEpochMs
            ));
        }
        tables.sort(Comparator.comparingLong(RpsLobbyTableDto::createdAtEpochMs).reversed());
        return tables;
    }

    public RpsTableResponse joinTable(String rawCode, JoinRpsTableRequest request) {
        String code = normalizeCode(rawCode);
        String name = normalizeName(request == null ? null : request.name());
        String password = request == null ? null : request.password();
        String requestToken = normalizeRequestToken(request == null ? null : request.requestToken());
        return withTableLock(code, () -> {
            StoredTable table = requireTable(code);
            ensureDefaults(table);
            settleIfNeeded(table);

            StoredJoinRequest existingRequest = findJoinRequest(table, requestToken);
            if (existingRequest != null) {
                return buildResponseWithToken(table, existingRequest.requestToken);
            }
            if (table.playerTwoToken != null) {
                throw ApiException.badRequest("这张桌子已经坐满了");
            }

            if ("PUBLIC".equals(table.accessMode)) {
                String playerToken = requestToken == null ? UUID.randomUUID().toString() : requestToken;
                seatPlayerTwo(table, playerToken, name);
                saveTable(table);
                return buildResponseWithToken(table, playerToken);
            }

            if ("ENCRYPTED".equals(table.accessMode)) {
                String normalizedPassword = normalizePassword(password);
                if (table.passwordHash == null || !passwordEncoder.matches(normalizedPassword, table.passwordHash)) {
                    throw ApiException.unauthorized("房间密码错误");
                }
            }

            String playerToken = requestToken == null ? UUID.randomUUID().toString() : requestToken;
            table.joinRequests.add(new StoredJoinRequest(playerToken, name, now(), "PENDING"));
            saveTable(table);
            return buildResponseWithToken(table, playerToken);
        });
    }

    public RpsTableResponse reviewJoinRequest(String rawCode, String ownerToken, String rawRequestToken, boolean approve) {
        String code = normalizeCode(rawCode);
        String requestToken = normalizeRequestToken(rawRequestToken);
        if (requestToken == null) {
            throw ApiException.badRequest("缺少加入申请凭证");
        }
        return withTableLock(code, () -> {
            StoredTable table = requireTable(code);
            ensureDefaults(table);
            requireOwner(table, ownerToken);
            StoredJoinRequest request = findJoinRequest(table, requestToken);
            if (request == null) {
                throw ApiException.notFound("加入申请不存在或已过期");
            }
            if (!"PENDING".equals(request.status)) {
                return buildResponse(table, ownerToken);
            }
            if (approve) {
                if (table.playerTwoToken != null) {
                    throw ApiException.badRequest("这张桌子已经坐满了");
                }
                seatPlayerTwo(table, request.requestToken, request.name);
                request.status = "APPROVED";
                table.joinRequests.stream()
                        .filter(other -> "PENDING".equals(other.status) && !request.requestToken.equals(other.requestToken))
                        .forEach(other -> other.status = "REJECTED");
            } else {
                request.status = "REJECTED";
            }
            saveTable(table);
            return buildResponse(table, ownerToken);
        });
    }

    public RpsTableResponse getTable(String rawCode, String playerToken) {
        String code = normalizeCode(rawCode);
        return withTableLock(code, () -> {
            StoredTable table = requireTable(code);
            requireSeat(table, playerToken);
            settleIfNeeded(table);
            return buildResponse(table, playerToken);
        });
    }

    public RpsTableResponse submitChoice(String rawCode, String playerToken, String rawChoice) {
        String code = normalizeCode(rawCode);
        String choice = normalizeChoice(rawChoice);
        return withTableLock(code, () -> {
            StoredTable table = requireTable(code);
            String seat = requirePlayableSeat(table, playerToken);
            settleIfNeeded(table);
            if (!"CHOOSING".equals(table.phase)) {
                throw ApiException.badRequest("当前不是出拳阶段");
            }
            if (table.playerTwoToken == null) {
                throw ApiException.badRequest("请等待第二位玩家加入");
            }
            if ("one".equals(seat) && table.playerOneChoice != null
                    || "two".equals(seat) && table.playerTwoChoice != null) {
                throw ApiException.badRequest("你已经锁定了本局出拳");
            }

            if ("one".equals(seat)) {
                table.playerOneChoice = choice;
            } else {
                table.playerTwoChoice = choice;
            }
            if (table.playerOneChoice != null && table.playerTwoChoice != null) {
                table.revealAtEpochMs = now() + Math.max(0L, revealDelayMs);
            }
            settleIfNeeded(table);
            saveTable(table);
            return buildResponse(table, playerToken);
        });
    }

    public RpsTableResponse nextRound(String rawCode, String playerToken) {
        String code = normalizeCode(rawCode);
        return withTableLock(code, () -> {
            StoredTable table = requireTable(code);
            requirePlayableSeat(table, playerToken);
            settleIfNeeded(table);
            if (!"REVEALED".equals(table.phase)) {
                throw ApiException.badRequest("当前对局还没有揭晓");
            }
            if (table.playerTwoToken == null) {
                throw ApiException.badRequest("请等待第二位玩家加入");
            }

            table.round += 1;
            table.phase = "CHOOSING";
            table.revealAtEpochMs = null;
            table.playerOneChoice = null;
            table.playerTwoChoice = null;
            saveTable(table);
            return buildResponse(table, playerToken);
        });
    }

    private void settleIfNeeded(StoredTable table) {
        if (!"CHOOSING".equals(table.phase)
                || table.playerOneChoice == null
                || table.playerTwoChoice == null
                || table.revealAtEpochMs == null
                || now() < table.revealAtEpochMs) {
            return;
        }

        String winner = resolveWinner(table.playerOneChoice, table.playerTwoChoice);
        String winnerName = switch (winner) {
            case "player-one" -> table.playerOneName;
            case "player-two" -> table.playerTwoName;
            default -> null;
        };
        if ("player-one".equals(winner)) {
            table.playerOneScore += 1;
        } else if ("player-two".equals(winner)) {
            table.playerTwoScore += 1;
        } else {
            table.draws += 1;
        }

        if (table.history == null) {
            table.history = new ArrayList<>();
        }
        table.history.add(new StoredRound(
                table.round,
                winner,
                winnerName,
                table.playerOneChoice,
                table.playerTwoChoice
        ));
        if (table.history.size() > MAX_HISTORY_SIZE) {
            table.history = new ArrayList<>(table.history.subList(table.history.size() - MAX_HISTORY_SIZE, table.history.size()));
        }
        table.phase = "REVEALED";
        table.revealAtEpochMs = null;
        saveTable(table);
    }

    private RpsTableResponse buildResponse(StoredTable table, String playerToken) {
        ensureDefaults(table);
        long currentTime = now();
        String seat = requireSeat(table, playerToken);
        String phase = viewPhase(table, currentTime);
        boolean revealChoices = "REVEALED".equals(phase);
        Long revealAt = "COUNTDOWN".equals(phase) ? table.revealAtEpochMs : null;
        List<RpsJoinRequestDto> pendingRequests = "one".equals(seat) ? toPendingRequestDtos(table.joinRequests) : List.of();

        return new RpsTableResponse(
                table.code,
                null,
                seat,
                phase,
                table.round,
                currentTime,
                revealAt,
                toPlayerDto(table, "one", revealChoices),
                toPlayerDto(table, "two", revealChoices),
                new RpsScoreDto(table.playerOneScore, table.playerTwoScore, table.draws),
                toHistory(table.history),
                table.playerOneName,
                table.accessMode,
                accessStatus(table, playerToken),
                pendingRequests,
                table.createdAtEpochMs
        );
    }

    private RpsTableResponse buildResponseWithToken(StoredTable table, String playerToken) {
        RpsTableResponse response = buildResponse(table, playerToken);
        return new RpsTableResponse(
                response.code(),
                playerToken,
                response.seat(),
                response.phase(),
                response.round(),
                response.serverNowEpochMs(),
                response.revealAtEpochMs(),
                response.playerOne(),
                response.playerTwo(),
                response.score(),
                response.history(),
                response.ownerName(),
                response.accessMode(),
                response.accessStatus(),
                response.pendingJoinRequests(),
                response.createdAtEpochMs()
        );
    }

    private RpsPlayerDto toPlayerDto(StoredTable table, String seat, boolean revealChoices) {
        boolean first = "one".equals(seat);
        String token = first ? table.playerOneToken : table.playerTwoToken;
        String name = first ? table.playerOneName : table.playerTwoName;
        IdentityValue identity = first ? table.playerOneIdentity : table.playerTwoIdentity;
        String choice = first ? table.playerOneChoice : table.playerTwoChoice;
        return new RpsPlayerDto(
                seat,
                name,
                identity == null ? null : identity.glyph,
                identity == null ? null : identity.label,
                identity == null ? null : identity.description,
                token != null,
                choice != null,
                revealChoices ? choice : null
        );
    }

    private List<RpsRoundSummaryDto> toHistory(List<StoredRound> rounds) {
        if (rounds == null || rounds.isEmpty()) {
            return List.of();
        }
        return rounds.stream()
                .map(round -> new RpsRoundSummaryDto(
                        round.round,
                        round.winner,
                        round.winnerName,
                        round.playerOneChoice,
                        round.playerTwoChoice
                ))
                .toList();
    }

    private List<RpsJoinRequestDto> toPendingRequestDtos(List<StoredJoinRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return List.of();
        }
        return requests.stream()
                .filter(request -> "PENDING".equals(request.status))
                .map(request -> new RpsJoinRequestDto(
                        request.requestToken,
                        request.name,
                        request.requestedAtEpochMs,
                        request.status
                ))
                .toList();
    }

    private String viewPhase(StoredTable table, long currentTime) {
        if (table.playerTwoToken == null) {
            return "WAITING";
        }
        if ("REVEALED".equals(table.phase)) {
            return "REVEALED";
        }
        if (table.revealAtEpochMs != null && currentTime < table.revealAtEpochMs) {
            return "COUNTDOWN";
        }
        return "CHOOSING";
    }

    private StoredTable requireTable(String code) {
        StoredTable table = loadTable(code);
        if (table == null) {
            throw ApiException.notFound("猜拳桌不存在或已过期");
        }
        ensureDefaults(table);
        return table;
    }

    private String requireSeat(StoredTable table, String playerToken) {
        if (playerToken == null || playerToken.isBlank()) {
            throw ApiException.badRequest("缺少玩家凭证");
        }
        if (playerToken.equals(table.playerOneToken)) {
            return "one";
        }
        if (playerToken.equals(table.playerTwoToken)) {
            return "two";
        }
        StoredJoinRequest request = findJoinRequest(table, playerToken);
        if (request != null && "PENDING".equals(request.status)) {
            return "pending";
        }
        if (request != null && "REJECTED".equals(request.status)) {
            return "rejected";
        }
        throw ApiException.unauthorized("你不是这张猜拳桌的玩家");
    }

    private String requirePlayableSeat(StoredTable table, String playerToken) {
        String seat = requireSeat(table, playerToken);
        if (!"one".equals(seat) && !"two".equals(seat)) {
            throw ApiException.forbidden("房主还没有同意你进入这张桌子");
        }
        return seat;
    }

    private void requireOwner(StoredTable table, String ownerToken) {
        if (ownerToken == null || !ownerToken.equals(table.playerOneToken)) {
            throw ApiException.forbidden("只有房主可以处理加入申请");
        }
    }

    private String accessStatus(StoredTable table, String playerToken) {
        if (playerToken != null && (playerToken.equals(table.playerOneToken) || playerToken.equals(table.playerTwoToken))) {
            return "APPROVED";
        }
        StoredJoinRequest request = findJoinRequest(table, playerToken);
        return request == null ? "NONE" : request.status;
    }

    private StoredJoinRequest findJoinRequest(StoredTable table, String requestToken) {
        if (requestToken == null || table.joinRequests == null) {
            return null;
        }
        return table.joinRequests.stream()
                .filter(request -> requestToken.equals(request.requestToken))
                .findFirst()
                .orElse(null);
    }

    private void seatPlayerTwo(StoredTable table, String playerToken, String name) {
        table.playerTwoToken = playerToken;
        table.playerTwoName = name;
        table.playerTwoIdentity = randomIdentity(table.playerOneIdentity == null ? null : table.playerOneIdentity.label);
        table.phase = "CHOOSING";
    }

    private int joinedPlayers(StoredTable table) {
        return (table.playerOneToken == null ? 0 : 1) + (table.playerTwoToken == null ? 0 : 1);
    }

    private boolean hasPendingRequests(StoredTable table) {
        return table.joinRequests != null && table.joinRequests.stream().anyMatch(request -> "PENDING".equals(request.status));
    }

    private String normalizeName(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            return "匿名玩家";
        }
        if (normalized.length() > 12) {
            throw ApiException.badRequest("昵称不能超过 12 个字符");
        }
        return normalized;
    }

    private String normalizeAccessMode(String value) {
        String normalized = value == null ? "PUBLIC" : value.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return "PUBLIC";
        }
        if (!List.of("PUBLIC", "FRIENDS", "ENCRYPTED").contains(normalized)) {
            throw ApiException.badRequest("房间类型无效");
        }
        return normalized;
    }

    private String createPasswordHash(String accessMode, String value) {
        if (!"ENCRYPTED".equals(accessMode)) {
            return null;
        }
        return passwordEncoder.encode(normalizePassword(value));
    }

    private String normalizePassword(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() < 4 || normalized.length() > 64) {
            throw ApiException.badRequest("房间密码长度需要为 4 到 64 个字符");
        }
        return normalized;
    }

    private String normalizeRequestToken(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > 80) {
            throw ApiException.badRequest("加入申请凭证无效");
        }
        return normalized;
    }

    private String normalizeCode(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!normalized.matches("[A-Z2-9]{6}")) {
            throw ApiException.badRequest("房间码格式不正确");
        }
        return normalized;
    }

    private String normalizeChoice(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (!List.of("rock", "paper", "scissors").contains(normalized)) {
            throw ApiException.badRequest("出拳选择无效");
        }
        return normalized;
    }

    static String resolveWinner(String playerOneChoice, String playerTwoChoice) {
        if (playerOneChoice.equals(playerTwoChoice)) {
            return "draw";
        }
        boolean playerOneWins = ("rock".equals(playerOneChoice) && "scissors".equals(playerTwoChoice))
                || ("paper".equals(playerOneChoice) && "rock".equals(playerTwoChoice))
                || ("scissors".equals(playerOneChoice) && "paper".equals(playerTwoChoice));
        return playerOneWins ? "player-one" : "player-two";
    }

    private IdentityValue randomIdentity(String excludedLabel) {
        List<IdentityValue> available = IDENTITIES.stream()
                .filter(identity -> !identity.label.equals(excludedLabel))
                .toList();
        return available.get(secureRandom.nextInt(available.size()));
    }

    private String generateRoomCode() {
        StringBuilder code = new StringBuilder(6);
        for (int index = 0; index < 6; index++) {
            code.append(ROOM_CODE_ALPHABET.charAt(secureRandom.nextInt(ROOM_CODE_ALPHABET.length())));
        }
        return code.toString();
    }

    private StoredTable loadTable(String code) {
        try {
            Object value = redisTemplate.opsForValue().get(tableKey(code));
            if (value != null) {
                StoredTable table = objectMapper.readValue(String.valueOf(value), StoredTable.class);
                ensureDefaults(table);
                localTables.put(code, table);
                activeTableCodes.add(code);
                return table;
            }
        } catch (Exception ignored) {
            // Use the local copy when Redis is temporarily unavailable.
        }

        StoredTable local = localTables.get(code);
        if (local != null && local.createdAtEpochMs + TABLE_TTL_SECONDS * 1000 < now()) {
            localTables.remove(code, local);
            activeTableCodes.remove(code);
            return null;
        }
        if (local != null) {
            ensureDefaults(local);
        }
        return local;
    }

    private void saveTable(StoredTable table) {
        ensureDefaults(table);
        localTables.put(table.code, table);
        activeTableCodes.add(table.code);
        try {
            String payload = objectMapper.writeValueAsString(table);
            redisTemplate.opsForValue().set(tableKey(table.code), payload, Duration.ofSeconds(TABLE_TTL_SECONDS));
            redisTemplate.opsForSet().add(TABLE_INDEX_KEY, table.code);
            redisTemplate.expire(TABLE_INDEX_KEY, Duration.ofSeconds(TABLE_TTL_SECONDS));
        } catch (JsonProcessingException ignored) {
            // The in-memory copy still keeps a single backend instance usable.
        } catch (Exception ignored) {
            // Redis is an acceleration layer for these short-lived rooms.
        }
    }

    private void ensureDefaults(StoredTable table) {
        if (table.accessMode == null || table.accessMode.isBlank()) {
            table.accessMode = "PUBLIC";
        }
        if (table.phase == null || table.phase.isBlank()) {
            table.phase = table.playerTwoToken == null ? "WAITING" : "CHOOSING";
        }
        if (table.history == null) {
            table.history = new ArrayList<>();
        }
        if (table.joinRequests == null) {
            table.joinRequests = new ArrayList<>();
        }
    }

    private String tableKey(String code) {
        return TABLE_KEY_PREFIX + code;
    }

    private long now() {
        return System.currentTimeMillis();
    }

    private <T> T withTableLock(String code, Supplier<T> action) {
        Object lock = tableLocks.computeIfAbsent(code, ignored -> new Object());
        synchronized (lock) {
            return action.get();
        }
    }

    private static final class IdentityValue {
        public String glyph;
        public String label;
        public String description;

        private IdentityValue() {
        }

        private IdentityValue(String glyph, String label, String description) {
            this.glyph = glyph;
            this.label = label;
            this.description = description;
        }
    }

    private static final class StoredTable {
        public String code;
        public long createdAtEpochMs;
        public String accessMode;
        public String passwordHash;
        public int round;
        public String phase;
        public String playerOneToken;
        public String playerOneName;
        public IdentityValue playerOneIdentity;
        public String playerTwoToken;
        public String playerTwoName;
        public IdentityValue playerTwoIdentity;
        public String playerOneChoice;
        public String playerTwoChoice;
        public Long revealAtEpochMs;
        public int playerOneScore;
        public int playerTwoScore;
        public int draws;
        public List<StoredRound> history;
        public List<StoredJoinRequest> joinRequests;

        private StoredTable() {
        }
    }

    private static final class StoredJoinRequest {
        public String requestToken;
        public String name;
        public long requestedAtEpochMs;
        public String status;

        private StoredJoinRequest() {
        }

        private StoredJoinRequest(String requestToken, String name, long requestedAtEpochMs, String status) {
            this.requestToken = requestToken;
            this.name = name;
            this.requestedAtEpochMs = requestedAtEpochMs;
            this.status = status;
        }
    }

    private static final class StoredRound {
        public int round;
        public String winner;
        public String winnerName;
        public String playerOneChoice;
        public String playerTwoChoice;

        private StoredRound() {
        }

        private StoredRound(int round, String winner, String winnerName, String playerOneChoice, String playerTwoChoice) {
            this.round = round;
            this.winner = winner;
            this.winnerName = winnerName;
            this.playerOneChoice = playerOneChoice;
            this.playerTwoChoice = playerTwoChoice;
        }
    }
}
