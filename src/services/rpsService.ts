import { apiRequest, type ApiRequestError } from "./api/client";

export type RpsChoice = "rock" | "paper" | "scissors";
export type RpsSeat = "one" | "two";
export type RpsPhase = "WAITING" | "CHOOSING" | "COUNTDOWN" | "REVEALED";

export interface RpsPlayer {
  seat: RpsSeat;
  name: string | null;
  glyph: string | null;
  identity: string | null;
  identityDescription: string | null;
  joined: boolean;
  hasChosen: boolean;
  choice: RpsChoice | null;
}
export interface RpsRoundSummary {
  round: number;
  winner: "draw" | "player-one" | "player-two";
  winnerName: string | null;
  playerOneChoice: RpsChoice;
  playerTwoChoice: RpsChoice;
}

export interface RpsTable {
  code: string;
  seat: RpsSeat;
  phase: RpsPhase;
  round: number;
  serverNowEpochMs: number;
  revealAtEpochMs: number | null;
  playerOne: RpsPlayer;
  playerTwo: RpsPlayer;
  score: {
    playerOne: number;
    playerTwo: number;
    draws: number;
  };
  history: RpsRoundSummary[];
  receivedAtEpochMs: number;
}

interface RpsPlayerResponse {
  seat: string;
  name?: string | null;
  glyph?: string | null;
  identity?: string | null;
  identityDescription?: string | null;
  joined?: boolean;
  hasChosen?: boolean;
  choice?: string | null;
}

interface RpsTableResponse {
  code: string;
  playerToken?: string | null;
  seat: string;
  phase: string;
  round: number;
  serverNowEpochMs: number;
  revealAtEpochMs?: number | null;
  playerOne: RpsPlayerResponse;
  playerTwo: RpsPlayerResponse;
  score: {
    playerOne: number;
    playerTwo: number;
    draws: number;
  };
  history?: Array<{
    round: number;
    winner: string;
    winnerName?: string | null;
    playerOneChoice: string;
    playerTwoChoice: string;
  }>;
}

export interface RpsSession {
  roomCode: string;
  playerToken: string;
}

function normalizeChoice(value: string | null | undefined): RpsChoice | null {
  return value === "rock" || value === "paper" || value === "scissors" ? value : null;
}

function normalizeSeat(value: string): RpsSeat {
  return value === "two" ? "two" : "one";
}

function normalizePhase(value: string): RpsPhase {
  if (value === "WAITING" || value === "COUNTDOWN" || value === "REVEALED") {
    return value;
  }
  return "CHOOSING";
}

function mapPlayer(value: RpsPlayerResponse, fallbackSeat: RpsSeat): RpsPlayer {
  return {
    seat: normalizeSeat(value.seat || fallbackSeat),
    name: value.name ?? null,
    glyph: value.glyph ?? null,
    identity: value.identity ?? null,
    identityDescription: value.identityDescription ?? null,
    joined: Boolean(value.joined),
    hasChosen: Boolean(value.hasChosen),
    choice: normalizeChoice(value.choice),
  };
}

function mapTable(value: RpsTableResponse): RpsTable {
  return {
    code: value.code,
    seat: normalizeSeat(value.seat),
    phase: normalizePhase(value.phase),
    round: value.round,
    serverNowEpochMs: value.serverNowEpochMs,
    revealAtEpochMs: value.revealAtEpochMs ?? null,
    playerOne: mapPlayer(value.playerOne, "one"),
    playerTwo: mapPlayer(value.playerTwo, "two"),
    score: value.score,
    history: (value.history ?? []).map((item) => ({
      round: item.round,
      winner:
        item.winner === "player-one" || item.winner === "player-two" ? item.winner : "draw",
      winnerName: item.winnerName ?? null,
      playerOneChoice: normalizeChoice(item.playerOneChoice) ?? "rock",
      playerTwoChoice: normalizeChoice(item.playerTwoChoice) ?? "rock",
    })),
    receivedAtEpochMs: Date.now(),
  };
}

function requirePlayerToken(value: RpsTableResponse) {
  if (!value.playerToken) {
    throw new Error("服务端没有返回玩家凭证，请重试");
  }
  return value.playerToken;
}

function request<T>(path: string, options: RequestInit = {}) {
  return apiRequest<T>(path, {
    authMode: "none",
    ...options,
  });
}

export function isRpsSessionError(error: unknown): error is ApiRequestError {
  return error instanceof Error && "status" in error && [401, 404].includes(Number((error as ApiRequestError).status));
}

export async function createRpsTable(name: string): Promise<{ session: RpsSession; table: RpsTable }> {
  const response = await request<RpsTableResponse>("/api/rps/tables", {
    method: "POST",
    body: JSON.stringify({ name }),
    headers: { "Content-Type": "application/json" },
  });
  const playerToken = requirePlayerToken(response);
  return {
    session: { roomCode: response.code, playerToken },
    table: mapTable(response),
  };
}

export async function joinRpsTable(roomCode: string, name: string): Promise<{ session: RpsSession; table: RpsTable }> {
  const response = await request<RpsTableResponse>(`/api/rps/tables/${encodeURIComponent(roomCode)}/join`, {
    method: "POST",
    body: JSON.stringify({ name }),
    headers: { "Content-Type": "application/json" },
  });
  const playerToken = requirePlayerToken(response);
  return {
    session: { roomCode: response.code, playerToken },
    table: mapTable(response),
  };
}

export async function fetchRpsTable(session: RpsSession): Promise<RpsTable> {
  const response = await request<RpsTableResponse>(`/api/rps/tables/${encodeURIComponent(session.roomCode)}`, {
    headers: { "X-Rps-Player-Token": session.playerToken },
  });
  return mapTable(response);
}

export async function submitRpsChoice(session: RpsSession, choice: RpsChoice): Promise<RpsTable> {
  const response = await request<RpsTableResponse>(`/api/rps/tables/${encodeURIComponent(session.roomCode)}/choice`, {
    method: "POST",
    body: JSON.stringify({ playerToken: session.playerToken, choice }),
    headers: { "Content-Type": "application/json" },
  });
  return mapTable(response);
}

export async function startNextRpsRound(session: RpsSession): Promise<RpsTable> {
  const response = await request<RpsTableResponse>(`/api/rps/tables/${encodeURIComponent(session.roomCode)}/next-round`, {
    method: "POST",
    body: JSON.stringify({ playerToken: session.playerToken }),
    headers: { "Content-Type": "application/json" },
  });
  return mapTable(response);
}
