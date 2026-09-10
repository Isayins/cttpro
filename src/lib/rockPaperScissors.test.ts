import { describe, expect, it } from "vitest";

import { resolveRpsWinner } from "./rockPaperScissors";

describe("resolveRpsWinner", () => {
  it("recognizes each winning combination", () => {
    expect(resolveRpsWinner("rock", "scissors")).toBe("player-one");
    expect(resolveRpsWinner("paper", "rock")).toBe("player-one");
    expect(resolveRpsWinner("scissors", "paper")).toBe("player-one");
  });

  it("returns the second player for the reverse combinations", () => {
    expect(resolveRpsWinner("scissors", "rock")).toBe("player-two");
    expect(resolveRpsWinner("rock", "paper")).toBe("player-two");
    expect(resolveRpsWinner("paper", "scissors")).toBe("player-two");
  });

  it("keeps identical choices as a draw", () => {
    expect(resolveRpsWinner("rock", "rock")).toBe("draw");
    expect(resolveRpsWinner("paper", "paper")).toBe("draw");
    expect(resolveRpsWinner("scissors", "scissors")).toBe("draw");
  });
});

