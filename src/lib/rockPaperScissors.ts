export type RpsChoice = "rock" | "paper" | "scissors";
export type RpsResult = "draw" | "player-one" | "player-two";

export const rpsChoices: readonly RpsChoice[] = ["rock", "paper", "scissors"];

export const rpsChoiceMeta: Record<
  RpsChoice,
  { label: string; glyph: string; tone: "warm" | "cool" | "violet" }
> = {
  rock: { label: "石头", glyph: "✊", tone: "warm" },
  paper: { label: "布", glyph: "✋", tone: "cool" },
  scissors: { label: "剪刀", glyph: "✌", tone: "violet" },
};

export function resolveRpsWinner(playerOne: RpsChoice, playerTwo: RpsChoice): RpsResult {
  if (playerOne === playerTwo) {
    return "draw";
  }

  const playerOneWins =
    (playerOne === "rock" && playerTwo === "scissors") ||
    (playerOne === "paper" && playerTwo === "rock") ||
    (playerOne === "scissors" && playerTwo === "paper");

  return playerOneWins ? "player-one" : "player-two";
}

