import { useEffect, useMemo, useState } from "react";
import { ArrowLeftOutlined, CheckOutlined, ReloadOutlined, TrophyOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";

import { rpsChoiceMeta, resolveRpsWinner, type RpsChoice, type RpsResult } from "../lib/rockPaperScissors";
import { routePaths } from "../router/routeAccess";
import "./RockPaperScissors.css";

type PlayerKey = "one" | "two";
type Phase = "lobby" | "choosing" | "countdown" | "revealed";

interface Identity {
  glyph: string;
  label: string;
  description: string;
}

interface PlayerSlot {
  name: string;
  joined: boolean;
  identity: Identity | null;
}

interface Score {
  one: number;
  two: number;
  draws: number;
}

type ChoiceMap = Record<PlayerKey, RpsChoice | null>;

const identityPool: Identity[] = [
  { glyph: "✦", label: "流星", description: "划过夜空的信使" },
  { glyph: "◒", label: "月亮", description: "安静观察潮汐" },
  { glyph: "⌁", label: "海浪", description: "总会找到出口" },
  { glyph: "△", label: "山峰", description: "把视野抬得更高" },
  { glyph: "✧", label: "灯塔", description: "为远方留一盏灯" },
  { glyph: "➹", label: "纸飞机", description: "把想法投向远方" },
  { glyph: "◈", label: "唱片", description: "记住每一段旋律" },
  { glyph: "⌂", label: "小屋", description: "给旅程一个落脚点" },
];

const initialChoices: ChoiceMap = { one: null, two: null };
const initialScore: Score = { one: 0, two: 0, draws: 0 };

function createInitialPlayers(): Record<PlayerKey, PlayerSlot> {
  return {
    one: { name: "", joined: false, identity: null },
    two: { name: "", joined: false, identity: null },
  };
}

function randomIndex(length: number) {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % length;
  }
  return Math.floor(Math.random() * length);
}

function pickIdentity(excludedLabel?: string) {
  const available = identityPool.filter((identity) => identity.label !== excludedLabel);
  return available[randomIndex(available.length)] ?? identityPool[0];
}

function getHistoryResultLabel(result: RpsResult, players: Record<PlayerKey, PlayerSlot>) {
  if (result === "draw") {
    return "平局";
  }
  return result === "player-one" ? players.one.name : players.two.name;
}

export default function RockPaperScissors() {
  const [players, setPlayers] = useState<Record<PlayerKey, PlayerSlot>>(() => createInitialPlayers());
  const [draftNames, setDraftNames] = useState<Record<PlayerKey, string>>({ one: "", two: "" });
  const [choices, setChoices] = useState<ChoiceMap>(initialChoices);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState<Score>(initialScore);
  const [history, setHistory] = useState<RpsResult[]>([]);

  const joinedCount = Number(players.one.joined) + Number(players.two.joined);
  const bothJoined = players.one.joined && players.two.joined;
  const playerOneChoice = choices.one;
  const playerTwoChoice = choices.two;
  const bothChosen = playerOneChoice !== null && playerTwoChoice !== null;
  const roundWinner = useMemo(
    () => (bothChosen ? resolveRpsWinner(playerOneChoice, playerTwoChoice) : null),
    [bothChosen, playerOneChoice, playerTwoChoice],
  );
  const visibleWinner = phase === "revealed" ? roundWinner : null;

  useEffect(() => {
    if (bothJoined && phase === "lobby") {
      setPhase("choosing");
    }
  }, [bothJoined, phase]);

  useEffect(() => {
    if (phase !== "choosing" || !bothChosen) {
      return;
    }
    setCountdown(3);
    setPhase("countdown");
  }, [bothChosen, phase]);

  useEffect(() => {
    if (phase !== "countdown") {
      return;
    }

    const startedAt = Date.now();
    const timerId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, 3 - Math.floor(elapsed / 1000));
      setCountdown(remaining);
      if (elapsed >= 3000) {
        window.clearInterval(timerId);
        setPhase("revealed");
        if (roundWinner) {
          setScore((current) => ({
            one: current.one + (roundWinner === "player-one" ? 1 : 0),
            two: current.two + (roundWinner === "player-two" ? 1 : 0),
            draws: current.draws + (roundWinner === "draw" ? 1 : 0),
          }));
          setHistory((current) => [roundWinner, ...current].slice(0, 6));
        }
      }
    }, 80);

    return () => window.clearInterval(timerId);
  }, [phase, roundWinner]);

  function handleJoin(player: PlayerKey) {
    const nextName = draftNames[player].trim() || `玩家 ${player === "one" ? "一" : "二"}`;
    const otherPlayer = player === "one" ? players.two : players.one;
    setPlayers((current) => ({
      ...current,
      [player]: {
        name: nextName,
        joined: true,
        identity: pickIdentity(otherPlayer.identity?.label),
      },
    }));
  }

  function handleChoice(player: PlayerKey, choice: RpsChoice) {
    if (phase !== "choosing" || !players[player].joined) {
      return;
    }
    setChoices((current) => ({ ...current, [player]: choice }));
  }

  function handleNextRound() {
    if (!bothJoined) {
      return;
    }
    setChoices(initialChoices);
    setCountdown(3);
    setPhase("choosing");
  }

  function handleReset() {
    setPlayers(createInitialPlayers());
    setDraftNames({ one: "", two: "" });
    setChoices(initialChoices);
    setPhase("lobby");
    setCountdown(3);
    setScore(initialScore);
    setHistory([]);
  }

  const statusLabel = phase === "lobby" ? "等待玩家加入" : phase === "choosing" ? "选择你的手势" : phase === "countdown" ? "即将揭晓" : "本局结果";
  const resultTitle =
    phase === "countdown"
      ? "已锁定"
      : visibleWinner === "draw"
      ? "平局"
      : visibleWinner === "player-one"
        ? `${players.one.name} 赢了`
        : visibleWinner === "player-two"
          ? `${players.two.name} 赢了`
          : "等待双方出拳";
  const resultDescription =
    phase === "countdown"
      ? "三秒后同时揭晓手势。"
      : visibleWinner === "draw"
      ? "两边选择相同，再来一局。"
      : visibleWinner
        ? "选择克制成功，计分已更新。"
        : "双方都选好后，倒计时会自动开始。";

  return (
    <div className="rps-page">
      <div className="rps-page__inner">
        <div className="rps-topbar">
          <Link className="rps-back-link" to={routePaths.home}>
            <ArrowLeftOutlined />
            返回首页
          </Link>
          <div className="rps-table-id">TABLE 02 / LOCAL DUEL</div>
        </div>

        <header className="rps-hero">
          <div>
            <p className="rps-eyebrow">TWO PLAYERS · ONE TABLE</p>
            <h1 className="rps-title">猜拳桌</h1>
            <p className="rps-subtitle">两位玩家入座后各自获得一张随机身份牌。选定手势，三秒后同时揭晓。</p>
          </div>
          <div className="rps-hero__signal">
            <TrophyOutlined />
            <span>已进行</span>
            <strong>{history.length}</strong>
            <span>局</span>
          </div>
        </header>

        <div className="rps-workspace">
          <section className="rps-table" aria-label="猜拳桌">
            <div className="rps-table__topline">
              <span><strong>对局状态</strong> · {statusLabel}</span>
              <span>{joinedCount}/2 已入座</span>
            </div>

            <div className="rps-table__stage">
              <PlayerPanel
                player="one"
                slot={players.one}
                draftName={draftNames.one}
                choice={choices.one}
                phase={phase}
                accent="one"
                onNameChange={(value) => setDraftNames((current) => ({ ...current, one: value }))}
                onJoin={() => handleJoin("one")}
                onChoice={(choice) => handleChoice("one", choice)}
              />

              <div className="rps-duel" aria-live="polite">
                <div className="rps-duel__label">ROUND {history.length + (phase === "revealed" ? 0 : 1)}</div>
                <div
                  className={`rps-countdown ${phase === "lobby" || phase === "choosing" ? "rps-countdown--waiting" : ""} ${phase === "revealed" ? "rps-countdown--revealed" : ""} ${phase === "countdown" ? "rps-countdown--pulse" : ""}`}
                >
                  {phase === "lobby" ? "READY" : phase === "choosing" ? "VS" : phase === "countdown" ? countdown : "DONE"}
                </div>
                <div className="rps-duel__vs">VS</div>
                <div className={`rps-result ${visibleWinner === "draw" ? "rps-result--draw" : visibleWinner ? "rps-result--win" : ""}`}>
                  <strong>{resultTitle}</strong>
                  <span>{resultDescription}</span>
                </div>
              </div>

              <PlayerPanel
                player="two"
                slot={players.two}
                draftName={draftNames.two}
                choice={choices.two}
                phase={phase}
                accent="two"
                onNameChange={(value) => setDraftNames((current) => ({ ...current, two: value }))}
                onJoin={() => handleJoin("two")}
                onChoice={(choice) => handleChoice("two", choice)}
              />
            </div>

            <div className="rps-table__footer">
              <span>{phase === "revealed" ? "结果已记录，可继续下一局" : "双方锁定后自动倒计时 3 秒"}</span>
              {phase === "revealed" ? (
                <button className="rps-next-round" type="button" onClick={handleNextRound}>
                  <ReloadOutlined />
                  下一局
                </button>
              ) : null}
            </div>
          </section>

          <aside className="rps-side">
            <section className="rps-side-card">
              <p className="rps-side-card__eyebrow">LIVE SCORE</p>
              <h2>当前比分</h2>
              <div className="rps-score-list">
                <ScoreRow player="one" name={players.one.name || "等待玩家一"} score={score.one} />
                <ScoreRow player="two" name={players.two.name || "等待玩家二"} score={score.two} />
              </div>
              <div className="rps-draws">
                <span>平局</span>
                <strong>{score.draws}</strong>
              </div>
            </section>

            <section className="rps-side-card">
              <p className="rps-side-card__eyebrow">ROUND LOG</p>
              <h2>最近结果</h2>
              <div className="rps-history">
                {history.length === 0 ? (
                  <div className="rps-history__empty">还没有完成的对局。</div>
                ) : (
                  history.map((result, index) => (
                    <div className="rps-history__row" key={`${result}-${index}`}>
                      <span>第 {history.length - index} 局</span>
                      <span className={`rps-history__result ${result === "draw" ? "rps-history__result--draw" : ""}`}>
                        {getHistoryResultLabel(result, players)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <button className="rps-reset" type="button" onClick={handleReset}>
                <ReloadOutlined />
                重置桌子
              </button>
            </section>

            <section className="rps-side-card">
              <p className="rps-side-card__eyebrow">TABLE NOTES</p>
              <div className="rps-legend">
                <div className="rps-legend__item">
                  <span className="rps-legend__mark">01</span>
                  <span>加入桌子后，会随机拿到一张身份牌。</span>
                </div>
                <div className="rps-legend__item">
                  <span className="rps-legend__mark rps-legend__mark--mint"><CheckOutlined /></span>
                  <span>双方都锁定手势，倒计时自动开始。</span>
                </div>
                <div className="rps-legend__item">
                  <span className="rps-legend__mark rps-legend__mark--violet">3s</span>
                  <span>揭晓后，胜者自动增加 1 分。</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

interface PlayerPanelProps {
  player: PlayerKey;
  slot: PlayerSlot;
  draftName: string;
  choice: RpsChoice | null;
  phase: Phase;
  accent: "one" | "two";
  onNameChange: (value: string) => void;
  onJoin: () => void;
  onChoice: (choice: RpsChoice) => void;
}

function PlayerPanel({ player, slot, draftName, choice, phase, accent, onNameChange, onJoin, onChoice }: PlayerPanelProps) {
  const playerLabel = player === "one" ? "玩家一" : "玩家二";
  const identityLabel = slot.identity?.label ?? "等待身份";
  const roleLabel = slot.identity?.description ?? "输入昵称后加入桌子";

  return (
    <article className={`rps-player rps-player--${accent}`}>
      <div className="rps-player__header">
        <span className="rps-player__seat">SEAT {player === "one" ? "01" : "02"}</span>
        <span className={`rps-player__status ${slot.joined ? "rps-player__status--joined" : ""}`}>
          {slot.joined ? "已入座" : "空位"}
        </span>
      </div>

      <div className="rps-player__identity">
        <div className="rps-player__token" aria-hidden="true">{slot.identity?.glyph ?? "·"}</div>
        <div>
          <h2 className="rps-player__name">{slot.joined ? slot.name : playerLabel}</h2>
          <p className="rps-player__role">{slot.joined ? `${identityLabel} · ${roleLabel}` : roleLabel}</p>
        </div>
      </div>

      {!slot.joined ? (
        <>
          <input
            className="rps-player__input"
            value={draftName}
            onChange={(event) => onNameChange(event.target.value)}
            maxLength={12}
            placeholder={`输入${playerLabel}昵称`}
            aria-label={`${playerLabel}昵称`}
          />
          <button className="rps-player__join" type="button" onClick={onJoin}>
            加入桌子
          </button>
        </>
      ) : (
        <>
          <span className="rps-choice-label">选择手势</span>
          <div className="rps-choice-grid">
            {(Object.keys(rpsChoiceMeta) as RpsChoice[]).map((item) => (
              <button
                className={`rps-choice ${choice === item ? "rps-choice--selected" : ""}`}
                key={item}
                type="button"
                disabled={phase !== "choosing" || choice !== null}
                onClick={() => onChoice(item)}
                aria-label={`${playerLabel}选择${rpsChoiceMeta[item].label}`}
              >
                <span className="rps-choice__icon" aria-hidden="true">{rpsChoiceMeta[item].glyph}</span>
                <span className="rps-choice__name">{rpsChoiceMeta[item].label}</span>
              </button>
            ))}
          </div>
          {choice ? <div className="rps-choice__locked"><CheckOutlined /> 已锁定，等待揭晓</div> : null}
        </>
      )}
    </article>
  );
}

interface ScoreRowProps {
  player: PlayerKey;
  name: string;
  score: number;
}

function ScoreRow({ player, name, score }: ScoreRowProps) {
  return (
    <div className={`rps-score-row rps-score-row--${player}`}>
      <div className="rps-score-row__name">
        {name}
        <span className="rps-score-row__role">{player === "one" ? "橙方" : "青方"}</span>
      </div>
      <span className="rps-score-row__score">{score}</span>
    </div>
  );
}
