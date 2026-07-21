import { describe, expect, it, vi } from "vitest";

import { runSessionInvalidatingMutation } from "./sessionMutation";

describe("session invalidating mutations", () => {
  it("clears the local session after the server accepts the mutation", async () => {
    const mutation = vi.fn().mockResolvedValue(undefined);
    const clearLocalSession = vi.fn();

    await runSessionInvalidatingMutation(mutation, clearLocalSession);

    expect(mutation).toHaveBeenCalledOnce();
    expect(clearLocalSession).toHaveBeenCalledOnce();
  });

  it("keeps the current session when the mutation fails", async () => {
    const mutation = vi.fn().mockRejectedValue(new Error("request failed"));
    const clearLocalSession = vi.fn();

    await expect(runSessionInvalidatingMutation(mutation, clearLocalSession)).rejects.toThrow("request failed");
    expect(clearLocalSession).not.toHaveBeenCalled();
  });
});
