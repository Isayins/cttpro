import { apiRequest, type ApiRequestError, type RequestOptions } from "./api/client";

export type RpsChoice = "rock" | "paper" | "scissors";
export type RpsSeat = "one" | "two" | "pending" | "rejected";
export type RpsPhase = "WAITING" | "CHOOSING" | "COUNTDOWN" | "REVEALED";
export type RpsAccessMode = "PUBLIC" | "FRIENDS" | "ENCRYPTED";
export type RpsAccessStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export interface RpsJoinRequest {
  requestToken: string;
  name: string;
  requestedAtEpochMs: number;
  status: "PENDING";
}

export interface RpsLobbyTable {
  code: string;
  ownerName: string;
  accessMode: RpsAccessMode;
  phase: RpsPhase;
  joinedPlayers: number;
  hasPendingRequests: boolean;
  createdAtEpochMs: number;
}

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
  ownerName: string;
  accessMode: RpsAccessMode;
  accessStatus: RpsAccessStatus;
  pendingJoinRequests: RpsJoinRequest[];
  createdAtEpochMs: number;
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
  ownerName?: string | null;
  accessMode?: string | null;
  accessStatus?: string | null;
  pendingJoinRequests?: Array<{
    requestToken: string;
    name: string;
    requestedAtEpochMs: number;
    status: string;
  }>;
  createdAtEpochMs?: number;
}

interface RpsLobbyTableResponse {
  code: string;
  ownerName?: string | null;
  accessMode?: string | null;
  phase?: string | null;
  joinedPlayers?: number;
  hasPendingRequests?: boolean;
  createdAtEpochMs?: number;
}

export interface RpsSession {
  roomCode: string;
  playerToken: string;
}

function normalizeChoice(value: string | null | undefined): RpsChoice | null {
  return value === "rock" || value === "paper" || value === "scissors" ? value : null;
}

function normalizeSeat(value: string): RpsSeat {
  if (value === "two" || value === "pending" || value === "rejected") {
    return value;
  }
  return "one";
}

function normalizePhase(value: string): RpsPhase {
  if (value === "WAITING" || value === "COUNTDOWN" || value === "REVEALED") {
    return value;
  }
  return "CHOOSING";
}

function normalizeAccessMode(value: string | null | undefined): RpsAccessMode {
  return value === "FRIENDS" || value === "ENCRYPTED" ? value : "PUBLIC";
}

function normalizeAccessStatus(value: string | null | undefined): RpsAccessStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED" ? value : "NONE";
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
    ownerName: value.ownerName ?? value.playerOne.name ?? "房主",
    accessMode: normalizeAccessMode(value.accessMode),
    accessStatus: normalizeAccessStatus(value.accessStatus),
    pendingJoinRequests: (value.pendingJoinRequests ?? [])
      .filter((item) => item.status === "PENDING")
      .map((item) => ({
        requestToken: item.requestToken,
        name: item.name,
        requestedAtEpochMs: item.requestedAtEpochMs,
        status: "PENDING" as const,
      })),
    createdAtEpochMs: value.createdAtEpochMs ?? Date.now(),
    receivedAtEpochMs: Date.now(),
  };
}

function mapLobbyTable(value: RpsLobbyTableResponse): RpsLobbyTable {
  return {
    code: value.code,
    ownerName: value.ownerName ?? "匿名玩家",
    accessMode: normalizeAccessMode(value.accessMode),
    phase: normalizePhase(value.phase ?? "WAITING"),
    joinedPlayers: value.joinedPlayers ?? 1,
    hasPendingRequests: Boolean(value.hasPendingRequests),
    createdAtEpochMs: value.createdAtEpochMs ?? Date.now(),
  };
}

function requirePlayerToken(value: RpsTableResponse) {
  if (!value.playerToken) {
    throw new Error("服务端没有返回玩家凭证，请重试");
  }
  return value.playerToken;
}

function request<T>(path: string, options: RequestOptions = {}) {
  return apiRequest<T>(path, {
    authMode: "none",
    ...options,
  });
}

export function isRpsSessionError(error: unknown): error is ApiRequestError {
  return error instanceof Error && "status" in error && [401, 404].includes(Number((error as ApiRequestError).status));
}

export async function fetchRpsTables(): Promise<RpsLobbyTable[]> {
  const response = await request<RpsLobbyTableResponse[]>("/api/rps/tables");
  return response.map(mapLobbyTable);
}

export async function createRpsTable(name: string, accessMode: RpsAccessMode = "PUBLIC", password = ""): Promise<{ session: RpsSession; table: RpsTable }> {
  const response = await request<RpsTableResponse>("/api/rps/tables", {
    method: "POST",
    body: {
      name,
      accessMode,
      ...(accessMode === "ENCRYPTED" ? { password } : {}),
    },
    headers: { "Content-Type": "application/json" },
  });
  const playerToken = requirePlayerToken(response);
  return {
    session: { roomCode: response.code, playerToken },
    table: mapTable(response),
  };
}

export async function joinRpsTable(roomCode: string, name: string, password = "", requestToken?: string): Promise<{ session: RpsSession; table: RpsTable }> {
  const response = await request<RpsTableResponse>(`/api/rps/tables/${encodeURIComponent(roomCode)}/join`, {
    method: "POST",
    body: {
      name,
      ...(password ? { password } : {}),
      ...(requestToken ? { requestToken } : {}),
    },
    headers: { "Content-Type": "application/json" },
  });
  const playerToken = requirePlayerToken(response);
  return {
    session: { roomCode: response.code, playerToken },
    table: mapTable(response),
  };
}

export async function reviewRpsJoinRequest(session: RpsSession, requestToken: string, approved: boolean): Promise<RpsTable> {
  const action = approved ? "approve" : "reject";
  const response = await request<RpsTableResponse>(
    `/api/rps/tables/${encodeURIComponent(session.roomCode)}/requests/${encodeURIComponent(requestToken)}/${action}`,
    {
      method: "POST",
      body: { playerToken: session.playerToken },
      headers: { "Content-Type": "application/json" },
    },
  );
  return mapTable(response);
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
    body: { playerToken: session.playerToken, choice },
    headers: { "Content-Type": "application/json" },
  });
  return mapTable(response);
}

export async function startNextRpsRound(session: RpsSession): Promise<RpsTable> {
  const response = await request<RpsTableResponse>(`/api/rps/tables/${encodeURIComponent(session.roomCode)}/next-round`, {
    method: "POST",
    body: { playerToken: session.playerToken },
    headers: { "Content-Type": "application/json" },
  });
  return mapTable(response);
}
