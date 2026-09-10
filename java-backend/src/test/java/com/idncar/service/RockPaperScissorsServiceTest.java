package com.idncar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.exception.ApiException;
import com.idncar.model.dto.CreateRpsTableRequest;
import com.idncar.model.dto.JoinRpsTableRequest;
import com.idncar.model.dto.RpsTableResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class RockPaperScissorsServiceTest {

    private RockPaperScissorsService service;

    @BeforeEach
    void setUp() {
        service = new RockPaperScissorsService();
        ReflectionTestUtils.setField(service, "redisTemplate", mock(RedisTemplate.class));
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());
        ReflectionTestUtils.setField(service, "revealDelayMs", 0L);
    }

    @Test
    void createsAndJoinsATableWithDifferentIdentities() {
        RpsTableResponse created = service.createTable(new CreateRpsTableRequest("小明"));
        RpsTableResponse joined = service.joinTable(created.code(), new JoinRpsTableRequest("小红"));

        assertThat(created.playerToken()).isNotBlank();
        assertThat(created.seat()).isEqualTo("one");
        assertThat(joined.playerToken()).isNotBlank().isNotEqualTo(created.playerToken());
        assertThat(joined.seat()).isEqualTo("two");
        assertThat(joined.phase()).isEqualTo("CHOOSING");
        assertThat(joined.playerOne().identity()).isNotEqualTo(joined.playerTwo().identity());
    }

    @Test
    void hidesChoicesUntilTheRoundIsRevealed() {
        RpsTableResponse created = service.createTable(new CreateRpsTableRequest("小明"));
        RpsTableResponse joined = service.joinTable(created.code(), new JoinRpsTableRequest("小红"));

        RpsTableResponse firstChoice = service.submitChoice(created.code(), created.playerToken(), "rock");
        assertThat(firstChoice.phase()).isEqualTo("CHOOSING");
        assertThat(firstChoice.playerOne().hasChosen()).isTrue();
        assertThat(firstChoice.playerOne().choice()).isNull();
        assertThat(firstChoice.playerTwo().choice()).isNull();

        RpsTableResponse revealed = service.submitChoice(created.code(), joined.playerToken(), "scissors");
        assertThat(revealed.phase()).isEqualTo("REVEALED");
        assertThat(revealed.playerOne().choice()).isEqualTo("rock");
        assertThat(revealed.playerTwo().choice()).isEqualTo("scissors");
        assertThat(revealed.score().playerOne()).isEqualTo(1);
        assertThat(revealed.history()).hasSize(1);
    }

    @Test
    void rejectsAThirdPlayerAndInvalidChoices() {
        RpsTableResponse created = service.createTable(new CreateRpsTableRequest("小明"));
        service.joinTable(created.code(), new JoinRpsTableRequest("小红"));

        assertThatThrownBy(() -> service.joinTable(created.code(), new JoinRpsTableRequest("小刚")))
                .isInstanceOf(ApiException.class)
                .hasMessage("这张桌子已经坐满了");
        assertThatThrownBy(() -> service.submitChoice(created.code(), created.playerToken(), "lizard"))
                .isInstanceOf(ApiException.class)
                .hasMessage("出拳选择无效");
    }

    @Test
    void resolvesWinnerForAllChoicePairs() {
        assertThat(RockPaperScissorsService.resolveWinner("rock", "scissors")).isEqualTo("player-one");
        assertThat(RockPaperScissorsService.resolveWinner("paper", "rock")).isEqualTo("player-one");
        assertThat(RockPaperScissorsService.resolveWinner("scissors", "paper")).isEqualTo("player-one");
        assertThat(RockPaperScissorsService.resolveWinner("rock", "rock")).isEqualTo("draw");
    }
}
