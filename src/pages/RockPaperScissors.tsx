import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CopyOutlined,
  ReloadOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

import { rpsChoiceMeta } from "../lib/rockPaperScissors";
import { getErrorMessage } from "../lib/errorMessage";
import { routePaths } from "../router/routeAccess";
import {
  createRpsTable,
  fetchRpsTables,
  fetchRpsTable,
  isRpsSessionError,
  joinRpsTable,
  reviewRpsJoinRequest,
  startNextRpsRound,
  submitRpsChoice,
  type RpsChoice,
  type RpsAccessMode,
  type RpsPhase,
  type RpsPlayer,
  type RpsSession,
  type RpsTable,
} from "../services/rpsService";
import "./RockPaperScissors.css";

const RPS_SESSION_STORAGE_KEY = "idncar.rps.online-session";
const RPS_POLL_INTERVAL_MS = 700;
const RPS_LOBBY_POLL_INTERVAL_MS = 2500;

function readRpsSession(): RpsSession | null {
  try {
    const raw = window.localStorage.getItem(RPS_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const value = JSON.parse(raw) as Partial<RpsSession>;
    if (typeof value.roomCode !== "string" || typeof value.playerToken !== "string") {
      return null;
    }
    return { roomCode: value.roomCode, playerToken: value.playerToken };
  } catch {
    return null;
  }
}

function writeRpsSession(session: RpsSession) {
  window.localStorage.setItem(RPS_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearRpsSession() {
  window.localStorage.removeItem(RPS_SESSION_STORAGE_KEY);
}

function getInitialRoomCode() {
  return new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() ?? "";
}

function updateRoomUrl(roomCode: string | null) {
  const url = new URL(window.location.href);
  if (roomCode) {
    url.searchParams.set("room", roomCode);
  } else {
    url.searchParams.delete("room");
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function getRoundResult(table: RpsTable) {
  if (table.phase !== "REVEALED") {
    return null;
  }
  return table.history.find((item) => item.round === table.round) ?? table.history.at(-1) ?? null;
}

function getPlayerName(player: RpsPlayer, fallback: string) {
  return player.joined && player.name ? player.name : fallback;
}

export default function RockPaperScissors() {
  const [session, setSession] = useState<RpsSession | null>(() => readRpsSession());
  const [table, setTable] = useState<RpsTable | null>(null);
  const [createName, setCreateName] = useState("");
  const [createAccessMode, setCreateAccessMode] = useState<RpsAccessMode>("PUBLIC");
  const [createPassword, setCreatePassword] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState(() => getInitialRoomCode());
  const [joinPassword, setJoinPassword] = useState("");
  const [lobbyTables, setLobbyTables] = useState<Awaited<ReturnType<typeof fetchRpsTables>>>([]);
  const [loadingLobby, setLoadingLobby] = useState(true);
  const [loadingTable, setLoadingTable] = useState(Boolean(session));
  const [tableRetryKey, setTableRetryKey] = useState(0);
  const [action, setAction] = useState<"create" | "join" | "choice" | "next" | "approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  const roomCode = session?.roomCode ?? null;
  const playerToken = session?.playerToken ?? null;
  const roundResult = useMemo(() => (table ? getRoundResult(table) : null), [table]);
  const countdown = useMemo(() => {
    if (!table || table.phase !== "COUNTDOWN" || table.revealAtEpochMs === null) {
      return 0;
    }
    const elapsedSinceResponse = clock - table.receivedAtEpochMs;
    const remainingMs = table.revealAtEpochMs - table.serverNowEpochMs - elapsedSinceResponse;
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }, [clock, table]);

  useEffect(() => {
    if (!roomCode || !playerToken) {
      setTable(null);
      setLoadingTable(false);
      return;
    }

    let active = true;
    const refresh = async (silent: boolean) => {
      try {
        const nextTable = await fetchRpsTable({ roomCode, playerToken });
        if (!active) {
          return;
        }
        setTable(nextTable);
        setError(null);
        setLoadingTable(false);
      } catch (caughtError) {
        if (!active) {
          return;
        }
        if (isRpsSessionError(caughtError)) {
          clearRpsSession();
          setSession(null);
          setTable(null);
          setLoadingTable(false);
          setError("这张猜拳桌已过期，请重新创建或加入房间。");
        } else if (!silent) {
          setLoadingTable(false);
          setError(getErrorMessage(caughtError, "猜拳桌连接失败，请稍后重试"));
        }
      }
    };

    setLoadingTable(true);
    void refresh(false);
    const timerId = window.setInterval(() => {
      void refresh(true);
    }, RPS_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timerId);
    };
  }, [playerToken, roomCode, tableRetryKey]);

  useEffect(() => {
    if (session) {
      setLoadingLobby(false);
      return;
    }

    let active = true;
    const refreshLobby = async () => {
      try {
        const nextTables = await fetchRpsTables();
        if (active) {
          setLobbyTables(nextTables);
        }
      } catch {
        // The lobby can keep its last successful list while the service reconnects.
      } finally {
        if (active) {
          setLoadingLobby(false);
        }
      }
    };

    setLoadingLobby(true);
    void refreshLobby();
    const timerId = window.setInterval(() => {
      void refreshLobby();
    }, RPS_LOBBY_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timerId);
    };
  }, [session]);

  useEffect(() => {
    if (table?.phase !== "COUNTDOWN") {
      return;
    }
    setClock(Date.now());
    const timerId = window.setInterval(() => setClock(Date.now()), 80);
    return () => window.clearInterval(timerId);
  }, [table?.phase, table?.receivedAtEpochMs]);

  async function handleCreate() {
    if (action) {
      return;
    }
    setAction("create");
    setError(null);
    try {
      const result = await createRpsTable(createName, createAccessMode, createPassword);
      writeRpsSession(result.session);
      setSession(result.session);
      setTable(result.table);
      updateRoomUrl(result.session.roomCode);
      setCreateName("");
      setCreatePassword("");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "创建猜拳桌失败"));
    } finally {
      setAction(null);
    }
  }

  async function handleJoin(codeOverride?: string) {
    const normalizedCode = (codeOverride ?? joinCode).trim().toUpperCase();
    if (action) {
      return;
    }
    if (!normalizedCode) {
      setError("请输入房间码");
      return;
    }
    setAction("join");
    setError(null);
    try {
      const result = await joinRpsTable(normalizedCode, joinName, joinPassword);
      writeRpsSession(result.session);
      setSession(result.session);
      setTable(result.table);
      setJoinCode(result.session.roomCode);
      updateRoomUrl(result.session.roomCode);
      setJoinName("");
      setJoinPassword("");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "加入猜拳桌失败"));
    } finally {
      setAction(null);
    }
  }

  async function handleChoice(choice: RpsChoice) {
    if (!session || !table || action || table.phase !== "CHOOSING") {
      return;
    }
    const currentPlayer = table.seat === "one" ? table.playerOne : table.playerTwo;
    if (currentPlayer.hasChosen) {
      return;
    }
    setAction("choice");
    setError(null);
    try {
      setTable(await submitRpsChoice(session, choice));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "锁定出拳失败"));
    } finally {
      setAction(null);
    }
  }

  async function handleNextRound() {
    if (!session || action || table?.phase !== "REVEALED") {
      return;
    }
    setAction("next");
    setError(null);
    try {
      setTable(await startNextRpsRound(session));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "开始下一局失败"));
    } finally {
      setAction(null);
    }
  }

  async function handleReviewRequest(requestToken: string, approved: boolean) {
    if (!session || action || table?.seat !== "one") {
      return;
    }
    setAction(approved ? "approve" : "reject");
    setError(null);
    try {
      setTable(await reviewRpsJoinRequest(session, requestToken, approved));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, approved ? "批准加入申请失败" : "拒绝加入申请失败"));
    } finally {
      setAction(null);
    }
  }

  function handleLeave() {
    clearRpsSession();
    setSession(null);
    setTable(null);
    setError(null);
    setCopied(false);
    updateRoomUrl(null);
  }

  function handleRetryTable() {
    setError(null);
    setTable(null);
    setLoadingTable(true);
    setTableRetryKey((value) => value + 1);
  }

  async function handleCopyRoomCode() {
    if (!table) {
      return;
    }
    try {
      await navigator.clipboard.writeText(table.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("复制失败，请手动记下房间码");
    }
  }

  if (!table && !session) {
    return (
      <div className="rps-page">
        <div className="rps-page__inner">
          <TopBar />
          <header className="rps-hero">
            <div>
              <p className="rps-eyebrow">ONLINE TABLE · TWO DEVICES</p>
              <h1 className="rps-title">猜拳桌</h1>
              <p className="rps-subtitle">创建一张桌子，把房间码发给另一位玩家。两台设备加入同一桌，双方的出拳会在三秒后同时揭晓。</p>
            </div>
            <div className="rps-hero__signal">
              <span className="rps-table-id__dot" />
              <span>跨设备联机</span>
            </div>
          </header>

          <section className="rps-lobby" aria-label="创建或加入猜拳桌">
            <div className="rps-lobby__heading">
              <div>
                <p className="rps-side-card__eyebrow">START A DUEL</p>
                <h2>选择进入方式</h2>
              </div>
              <span className="rps-lobby__online"><span />服务在线</span>
            </div>

            <div className="rps-lobby__panels">
              <section className="rps-lobby-card rps-lobby-card--create">
                <div className="rps-lobby-card__number">01</div>
                <h3>创建新桌</h3>
                <p>你会坐在一号位，并获得一张随机身份牌。</p>
                <label className="rps-lobby-card__label" htmlFor="rps-create-name">你的昵称</label>
                <input
                  id="rps-create-name"
                  className="rps-player__input"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  maxLength={12}
                  placeholder="例如：小明"
                />
                <label className="rps-lobby-card__label" htmlFor="rps-create-access-mode">房间类型</label>
                <select
                  id="rps-create-access-mode"
                  className="rps-player__input rps-access-select"
                  value={createAccessMode}
                  onChange={(event) => setCreateAccessMode(event.target.value as RpsAccessMode)}
                >
                  <option value="PUBLIC">公开房 · 直接加入</option>
                  <option value="FRIENDS">好友房 · 房主审批</option>
                  <option value="ENCRYPTED">加密房 · 密码 + 审批</option>
                </select>
                {createAccessMode === "ENCRYPTED" ? (
                  <>
                    <label className="rps-lobby-card__label" htmlFor="rps-create-password">房间密码</label>
                    <input
                      id="rps-create-password"
                      className="rps-player__input"
                      type="password"
                      value={createPassword}
                      onChange={(event) => setCreatePassword(event.target.value)}
                      minLength={4}
                      maxLength={64}
                      placeholder="至少 4 个字符"
                    />
                  </>
                ) : null}
                <button className="rps-lobby-card__button rps-lobby-card__button--create" type="button" onClick={() => void handleCreate()} disabled={Boolean(action)}>
                  {action === "create" ? "正在创建..." : "创建猜拳桌"}
                </button>
              </section>

              <div className="rps-lobby__or">OR</div>

              <section className="rps-lobby-card rps-lobby-card--join">
                <div className="rps-lobby-card__number">02</div>
                <h3>加入已有桌</h3>
                <p>输入朋友分享的房间码，坐到二号位。</p>
                <label className="rps-lobby-card__label" htmlFor="rps-join-name">你的昵称</label>
                <input
                  id="rps-join-name"
                  className="rps-player__input"
                  value={joinName}
                  onChange={(event) => setJoinName(event.target.value)}
                  maxLength={12}
                  placeholder="例如：小红"
                />
                <label className="rps-lobby-card__label" htmlFor="rps-join-code">房间码</label>
                <input
                  id="rps-join-code"
                  className="rps-player__input rps-room-code-input"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="例如：7K9P2M"
                  autoCapitalize="characters"
                />
                <label className="rps-lobby-card__label" htmlFor="rps-join-password">房间密码（加密房填写）</label>
                <input
                  id="rps-join-password"
                  className="rps-player__input"
                  type="password"
                  value={joinPassword}
                  onChange={(event) => setJoinPassword(event.target.value)}
                  maxLength={64}
                  placeholder="公开房和好友房无需填写"
                />
                <button className="rps-lobby-card__button rps-lobby-card__button--join" type="button" onClick={() => void handleJoin()} disabled={Boolean(action)}>
                  {action === "join" ? "正在加入..." : "加入猜拳桌"}
                </button>
              </section>
            </div>
            <section className="rps-lobby__rooms" aria-label="已创建的猜拳桌">
              <div className="rps-lobby__rooms-heading">
                <div>
                  <p className="rps-side-card__eyebrow">OPEN TABLES</p>
                  <h3>已创建的桌子</h3>
                </div>
                <span>{loadingLobby ? "刷新中..." : `${lobbyTables.length} 张可加入`}</span>
              </div>
              {lobbyTables.length === 0 ? (
                <div className="rps-lobby__rooms-empty">暂时没有空桌，创建一张桌子等朋友加入。</div>
              ) : (
                <div className="rps-room-list">
                  {lobbyTables.map((lobbyTable) => (
                    <article className="rps-room-row" key={lobbyTable.code}>
                      <div className="rps-room-row__main">
                        <strong>{lobbyTable.code}</strong>
                        <span>{lobbyTable.ownerName} 的桌子</span>
                      </div>
                      <div className="rps-room-row__meta">
                        <span className={`rps-access-badge rps-access-badge--${lobbyTable.accessMode.toLowerCase()}`}>
                          {accessModeLabel(lobbyTable.accessMode)}
                        </span>
                        <span>{lobbyTable.joinedPlayers}/2</span>
                        {lobbyTable.hasPendingRequests ? <span>有申请</span> : null}
                      </div>
                      <button
                        className="rps-room-row__button"
                        type="button"
                        onClick={() => void handleJoin(lobbyTable.code)}
                        disabled={Boolean(action)}
                      >
                        {action === "join" ? "加入中..." : lobbyTable.accessMode === "PUBLIC" ? "直接加入" : "申请加入"}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
            {error ? <div className="rps-inline-error" role="alert">{error}</div> : null}
            <div className="rps-lobby__note">房间有效期为 2 小时。好友房需要房主同意；加密房还需要先输入密码。出拳在揭晓前不会发给对方设备。</div>
          </section>
        </div>
      </div>
    );
  }

  if (loadingTable || !table) {
    const connectionFailed = Boolean(session && !loadingTable && error);
    return (
      <div className="rps-page">
        <div className="rps-page__inner">
          <TopBar />
          <section className={`rps-loading ${connectionFailed ? "rps-loading--error" : ""}`} aria-live="polite">
            {connectionFailed ? <div className="rps-loading__error-mark">!</div> : <div className="rps-loading__ring" />}
            <strong>{connectionFailed ? "无法连接猜拳桌" : "正在连接猜拳桌"}</strong>
            <span>{connectionFailed ? "请检查网络或服务状态后重试。" : roomCode ? `房间码 ${roomCode}` : "正在读取房间"}</span>
            {error ? <div className="rps-inline-error" role="alert">{error}</div> : null}
            {connectionFailed ? (
              <div className="rps-loading__actions">
                <button className="rps-next-round" type="button" onClick={handleRetryTable}>
                  <ReloadOutlined />
                  重试连接
                </button>
                <button className="rps-reset" type="button" onClick={handleLeave}>
                  <ArrowLeftOutlined />
                  返回大厅
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    );
  }

  if (table.seat === "pending" || table.accessStatus === "PENDING") {
    return (
      <div className="rps-page">
        <div className="rps-page__inner">
          <TopBar />
          <section className="rps-access-state" aria-live="polite">
            <div className="rps-access-state__mark">…</div>
            <p className="rps-side-card__eyebrow">JOIN REQUEST SENT</p>
            <h2>申请已提交</h2>
            <p>房主同意后，你会自动进入二号位。这个页面会自动刷新申请状态。</p>
            <div className="rps-access-state__room">房间码 {table.code}</div>
            <button className="rps-reset" type="button" onClick={handleLeave}>
              <ArrowLeftOutlined />
              返回大厅
            </button>
          </section>
        </div>
      </div>
    );
  }

  if (table.seat === "rejected" || table.accessStatus === "REJECTED") {
    return (
      <div className="rps-page">
        <div className="rps-page__inner">
          <TopBar />
          <section className="rps-access-state rps-access-state--rejected" aria-live="polite">
            <div className="rps-access-state__mark">×</div>
            <p className="rps-side-card__eyebrow">REQUEST DECLINED</p>
            <h2>房主暂未同意加入</h2>
            <p>你可以返回大厅，选择其他桌子或重新发起申请。</p>
            <div className="rps-access-state__room">房间码 {table.code}</div>
            <button className="rps-reset" type="button" onClick={handleLeave}>
              <ArrowLeftOutlined />
              返回大厅
            </button>
          </section>
        </div>
      </div>
    );
  }

  const playerOneName = getPlayerName(table.playerOne, "等待玩家一");
  const playerTwoName = getPlayerName(table.playerTwo, "等待玩家二");
  const statusLabel = phaseLabel(table.phase);
  const resultTitle = getResultTitle(table, roundResult, playerOneName, playerTwoName);
  const resultDescription = getResultDescription(table.phase, roundResult);
  const joinedCount = Number(table.playerOne.joined) + Number(table.playerTwo.joined);

  return (
    <div className="rps-page">
      <div className="rps-page__inner">
        <div className="rps-topbar">
          <Link className="rps-back-link" to={routePaths.home}>
            <ArrowLeftOutlined />
            返回首页
          </Link>
          <div className="rps-table-id rps-table-id--room">
            <span className="rps-table-id__dot" />
            <span>房间码</span>
            <strong>{table.code}</strong>
            <button type="button" className="rps-table-id__copy" onClick={() => void handleCopyRoomCode()} title="复制房间码" aria-label="复制房间码">
              <CopyOutlined />
            </button>
          </div>
        </div>

        <header className="rps-hero">
          <div>
            <p className="rps-eyebrow">ONLINE DUEL · ROOM {table.code}</p>
            <h1 className="rps-title">猜拳桌</h1>
            <p className="rps-subtitle">把房间码发给另一位玩家。双方只会看到对方是否已锁定，手势会在倒计时结束后一起揭晓。</p>
          </div>
          <div className="rps-hero__signal">
            <TrophyOutlined />
            <span>已进行</span>
            <strong>{table.history.length}</strong>
            <span>局</span>
          </div>
        </header>

        <div className="rps-workspace">
          <section className="rps-table" aria-label="猜拳桌">
            <div className="rps-table__topline">
              <span><strong>对局状态</strong> · {statusLabel}</span>
              <span>{accessModeLabel(table.accessMode)} · {joinedCount}/2 已入座</span>
            </div>

            <div className="rps-table__stage">
              <RpsPlayerPanel
                player={table.playerOne}
                isMe={table.seat === "one"}
                phase={table.phase}
                submittingChoice={action === "choice"}
                onChoice={(choice) => void handleChoice(choice)}
              />

              <div className="rps-duel" aria-live="polite">
                <div className="rps-duel__label">ROUND {table.round}</div>
                <div className={`rps-countdown ${table.phase === "WAITING" || table.phase === "CHOOSING" ? "rps-countdown--waiting" : ""} ${table.phase === "REVEALED" ? "rps-countdown--revealed" : ""} ${table.phase === "COUNTDOWN" ? "rps-countdown--pulse" : ""}`}>
                  {table.phase === "WAITING" ? "WAIT" : table.phase === "CHOOSING" ? "VS" : table.phase === "COUNTDOWN" ? countdown : "DONE"}
                </div>
                <div className="rps-duel__vs">VS</div>
                <div className={`rps-result ${roundResult?.winner === "draw" ? "rps-result--draw" : roundResult ? "rps-result--win" : ""}`}>
                  <strong>{resultTitle}</strong>
                  <span>{resultDescription}</span>
                </div>
              </div>

              <RpsPlayerPanel
                player={table.playerTwo}
                isMe={table.seat === "two"}
                phase={table.phase}
                submittingChoice={action === "choice"}
                onChoice={(choice) => void handleChoice(choice)}
              />
            </div>

            <div className="rps-table__footer">
              <span>{table.phase === "WAITING" ? "把房间码发给另一位玩家即可入座" : table.phase === "REVEALED" ? "结果已记录，可继续下一局" : "双方锁定后自动倒计时 3 秒"}</span>
              {table.phase === "REVEALED" ? (
                <button className="rps-next-round" type="button" onClick={() => void handleNextRound()} disabled={Boolean(action)}>
                  <ReloadOutlined />
                  {action === "next" ? "准备中..." : "下一局"}
                </button>
              ) : null}
            </div>
          </section>

          <aside className="rps-side">
            {table.seat === "one" && table.pendingJoinRequests.length > 0 ? (
              <section className="rps-side-card rps-requests-card">
                <p className="rps-side-card__eyebrow">JOIN REQUESTS</p>
                <h2>加入申请</h2>
                <div className="rps-request-list">
                  {table.pendingJoinRequests.map((request) => (
                    <div className="rps-request-row" key={request.requestToken}>
                      <div>
                        <strong>{request.name}</strong>
                        <span>申请进入二号位</span>
                      </div>
                      <div className="rps-request-row__actions">
                        <button
                          type="button"
                          className="rps-request-button rps-request-button--approve"
                          onClick={() => void handleReviewRequest(request.requestToken, true)}
                          disabled={Boolean(action)}
                          title="批准加入"
                          aria-label={`批准${request.name}加入`}
                        >
                          <CheckOutlined />
                        </button>
                        <button
                          type="button"
                          className="rps-request-button rps-request-button--reject"
                          onClick={() => void handleReviewRequest(request.requestToken, false)}
                          disabled={Boolean(action)}
                          title="拒绝加入"
                          aria-label={`拒绝${request.name}加入`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="rps-side-card">
              <p className="rps-side-card__eyebrow">LIVE SCORE</p>
              <h2>当前比分</h2>
              <div className="rps-score-list">
                <ScoreRow player="one" name={playerOneName} score={table.score.playerOne} />
                <ScoreRow player="two" name={playerTwoName} score={table.score.playerTwo} />
              </div>
              <div className="rps-draws">
                <span>平局</span>
                <strong>{table.score.draws}</strong>
              </div>
            </section>

            <section className="rps-side-card">
              <p className="rps-side-card__eyebrow">ROUND LOG</p>
              <h2>最近结果</h2>
              <div className="rps-history">
                {table.history.length === 0 ? (
                  <div className="rps-history__empty">还没有完成的对局。</div>
                ) : (
                  [...table.history].reverse().map((item) => (
                    <div className="rps-history__row" key={item.round}>
                      <span>第 {item.round} 局</span>
                      <span className={`rps-history__result ${item.winner === "draw" ? "rps-history__result--draw" : ""}`}>
                        {item.winner === "draw" ? "平局" : item.winnerName ?? "胜者"}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <button className="rps-reset" type="button" onClick={handleLeave}>
                <ArrowLeftOutlined />
                离开当前桌
              </button>
            </section>

            <section className="rps-side-card">
              <p className="rps-side-card__eyebrow">TABLE NOTES</p>
              <div className="rps-legend">
                <div className="rps-legend__item">
                  <span className="rps-legend__mark">01</span>
                  <span>把房间码 <strong className="rps-room-code-text">{table.code}</strong> 发给另一位玩家。</span>
                </div>
                <div className="rps-legend__item">
                  <span className="rps-legend__mark rps-legend__mark--mint"><CheckOutlined /></span>
                  <span>双方只看到“已锁定”，看不到对方的具体手势。</span>
                </div>
                <div className="rps-legend__item">
                  <span className="rps-legend__mark rps-legend__mark--violet">3s</span>
                  <span>服务端统一揭晓并同步比分。</span>
                </div>
              </div>
              {copied ? <div className="rps-copy-hint">房间码已复制</div> : null}
            </section>
          </aside>
        </div>
        {error ? <div className="rps-inline-error rps-inline-error--page" role="alert">{error}</div> : null}
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="rps-topbar">
      <Link className="rps-back-link" to={routePaths.home}>
        <ArrowLeftOutlined />
        返回首页
      </Link>
      <div className="rps-table-id">ONLINE TABLE / TWO DEVICES</div>
    </div>
  );
}

function phaseLabel(phase: RpsPhase) {
  switch (phase) {
    case "WAITING":
      return "等待第二位玩家加入";
    case "CHOOSING":
      return "选择你的手势";
    case "COUNTDOWN":
      return "即将揭晓";
    case "REVEALED":
      return "本局结果";
  }
}

function accessModeLabel(accessMode: RpsAccessMode) {
  switch (accessMode) {
    case "FRIENDS":
      return "好友房 · 审批";
    case "ENCRYPTED":
      return "加密房 · 审批";
    default:
      return "公开房";
  }
}

function getResultTitle(table: RpsTable, roundResult: ReturnType<typeof getRoundResult>, playerOneName: string, playerTwoName: string) {
  if (table.phase === "WAITING") {
    return "等待入座";
  }
  if (table.phase === "CHOOSING") {
    return "等待双方出拳";
  }
  if (table.phase === "COUNTDOWN") {
    return "已锁定";
  }
  if (roundResult?.winner === "draw") {
    return "平局";
  }
  return roundResult?.winner === "player-one" ? `${playerOneName} 赢了` : `${playerTwoName} 赢了`;
}

function getResultDescription(phase: RpsPhase, roundResult: ReturnType<typeof getRoundResult>) {
  if (phase === "WAITING") {
    return "把房间码分享给另一位玩家。";
  }
  if (phase === "CHOOSING") {
    return "双方都选好后，倒计时会自动开始。";
  }
  if (phase === "COUNTDOWN") {
    return "三秒后同时揭晓手势。";
  }
  return roundResult?.winner === "draw" ? "两边选择相同，再来一局。" : "选择克制成功，计分已更新。";
}

interface RpsPlayerPanelProps {
  player: RpsPlayer;
  isMe: boolean;
  phase: RpsPhase;
  submittingChoice: boolean;
  onChoice: (choice: RpsChoice) => void;
}

function RpsPlayerPanel({ player, isMe, phase, submittingChoice, onChoice }: RpsPlayerPanelProps) {
  const playerLabel = player.seat === "one" ? "玩家一" : "玩家二";
  const name = getPlayerName(player, playerLabel);
  const canChoose = isMe && player.joined && phase === "CHOOSING" && !player.hasChosen && !submittingChoice;
  const shouldShowChoiceGrid = player.joined && phase !== "WAITING";

  return (
    <article className={`rps-player rps-player--${player.seat}`}>
      <div className="rps-player__header">
        <span className="rps-player__seat">SEAT {player.seat === "one" ? "01" : "02"}</span>
        <span className={`rps-player__status ${player.joined ? "rps-player__status--joined" : ""}`}>
          {isMe ? "我的座位" : player.joined ? "已入座" : "等待加入"}
        </span>
      </div>

      <div className="rps-player__identity">
        <div className="rps-player__token" aria-hidden="true">{player.glyph ?? "·"}</div>
        <div>
          <h2 className="rps-player__name">{name}</h2>
          <p className="rps-player__role">{player.joined ? `${player.identity ?? "身份牌"} · ${player.identityDescription ?? "准备对局"}` : "等待另一位玩家加入"}</p>
        </div>
      </div>

      {shouldShowChoiceGrid ? (
        <>
          <span className="rps-choice-label">{isMe ? "选择手势" : "对手手势"}</span>
          <div className="rps-choice-grid">
            {(Object.keys(rpsChoiceMeta) as RpsChoice[]).map((choice) => (
              <button
                className={`rps-choice ${phase === "REVEALED" && player.choice === choice ? "rps-choice--revealed" : ""}`}
                key={choice}
                type="button"
                disabled={!canChoose}
                onClick={() => onChoice(choice)}
                aria-label={`${playerLabel}选择${rpsChoiceMeta[choice].label}`}
              >
                <span className="rps-choice__icon" aria-hidden="true">{rpsChoiceMeta[choice].glyph}</span>
                <span className="rps-choice__name">{rpsChoiceMeta[choice].label}</span>
              </button>
            ))}
          </div>
          {phase === "REVEALED" && player.choice ? (
            <div className="rps-choice__locked"><CheckOutlined /> 本局出拳</div>
          ) : player.hasChosen ? (
            <div className="rps-choice__locked"><CheckOutlined /> {isMe ? "已锁定，等待揭晓" : "对手已锁定"}</div>
          ) : !isMe ? (
            <div className="rps-choice__locked rps-choice__locked--muted">等待对手选择</div>
          ) : null}
        </>
      ) : (
        <div className="rps-player__waiting">等待第二位玩家加入后开始出拳</div>
      )}
    </article>
  );
}

interface ScoreRowProps {
  player: "one" | "two";
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
