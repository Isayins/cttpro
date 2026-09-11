import { afterEach, describe, expect, it, vi } from "vitest";

import { createRpsTable } from "./rpsService";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("rock paper scissors API", () => {
  it("sends the create-table payload as a JSON object", async () => {
    const response = {
      code: "ABC234",
      playerToken: "player-token",
      seat: "one",
      phase: "WAITING",
      round: 1,
      serverNowEpochMs: 1,
      revealAtEpochMs: null,
      playerOne: {
        seat: "one",
        name: "aa",
        glyph: "✦",
        identity: "流星",
        identityDescription: "划过夜空的信使",
        joined: true,
        hasChosen: false,
        choice: null,
      },
      playerTwo: {
        seat: "two",
        name: null,
        glyph: null,
        identity: null,
        identityDescription: null,
        joined: false,
        hasChosen: false,
        choice: null,
      },
      score: { playerOne: 0, playerTwo: 0, draws: 0 },
      history: [],
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await createRpsTable("aa");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ name: "aa" }));
  });
});
