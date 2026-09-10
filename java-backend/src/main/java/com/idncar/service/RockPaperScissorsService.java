package com.idncar.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.exception.ApiException;
import com.idncar.model.dto.CreateRpsTableRequest;
import com.idncar.model.dto.JoinRpsTableRequest;
import com.idncar.model.dto.RpsPlayerDto;
import com.idncar.model.dto.RpsRoundSummaryDto;
import com.idncar.model.dto.RpsScoreDto;
import com.idncar.model.dto.RpsTableResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Service
public class RockPaperScissorsService {

    private static final String TABLE_KEY_PREFIX = "rps:table:";
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
    private final Map<String, StoredTable> localTables = new ConcurrentHashMap<>();
    private final Map<String, Object> tableLocks = new ConcurrentHashMap<>();

    public RpsTableResponse createTable(CreateRpsTableRequest request) {
        String name = normalizeName(request == null ? null : request.name());
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
            table.playerOneToken = playerToken;
            table.playerOneName = name;
            table.playerOneIdentity = identity;
            table.history = new ArrayList<>();
            saveTable(table);
            return buildResponseWithToken(table, playerToken);
        }
        throw ApiException.badGateway("暂时无法创建猜拳桌，请稍后重试");
    }

    public RpsTableResponse joinTable(String rawCode, JoinRpsTableRequest request) {
        String code = normalizeCode(rawCode);
        String name = normalizeName(request == null ? null : request.name());
        return withTableLock(code, () -> {
            StoredTable table = requireTable(code);
            settleIfNeeded(table);
            if (table.playerTwoToken != null) {
                throw ApiException.badRequest("这张桌子已经坐满了");
            }

            String playerToken = UUID.randomUUID().toString();
            table.playerTwoToken = playerToken;
            table.playerTwoName = name;
            table.playerTwoIdentity = randomIdentity(table.playerOneIdentity == null ? null : table.playerOneIdentity.label);
            table.phase = "CHOOSING";
            saveTable(table);
            return buildResponseWithToken(table, playerToken);
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
            String seat = requireSeat(table, playerToken);
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
            requireSeat(table, playerToken);
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
        long currentTime = now();
        String seat = requireSeat(table, playerToken);
        String phase = viewPhase(table, currentTime);
        boolean revealChoices = "REVEALED".equals(phase);
        Long revealAt = "COUNTDOWN".equals(phase) ? table.revealAtEpochMs : null;

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
                toHistory(table.history)
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
                response.history()
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
        throw ApiException.unauthorized("你不是这张猜拳桌的玩家");
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
                localTables.put(code, table);
                return table;
            }
        } catch (Exception ignored) {
            // Use the local copy when Redis is temporarily unavailable.
        }

        StoredTable local = localTables.get(code);
        if (local != null && local.createdAtEpochMs + TABLE_TTL_SECONDS * 1000 < now()) {
            localTables.remove(code, local);
            return null;
        }
        return local;
    }

    private void saveTable(StoredTable table) {
        localTables.put(table.code, table);
        try {
            String payload = objectMapper.writeValueAsString(table);
            redisTemplate.opsForValue().set(tableKey(table.code), payload, Duration.ofSeconds(TABLE_TTL_SECONDS));
        } catch (JsonProcessingException ignored) {
            // The in-memory copy still keeps a single backend instance usable.
        } catch (Exception ignored) {
            // Redis is an acceleration layer for these short-lived rooms.
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

        private StoredTable() {
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
