import { afterEach, describe, expect, it, vi } from "vitest";

import { runRegexInWorker } from "./regexWorkerClient";
import type { RegexWorkerResponse } from "./regexWorker";

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<RegexWorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  request: unknown;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(request: unknown) {
    this.request = request;
  }

  terminate() {
    this.terminated = true;
  }

  respond(response: RegexWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<RegexWorkerResponse>);
  }
}

describe("regex worker client", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
  });

  it("returns worker output and terminates the worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);

    const result = runRegexInWorker({ pattern: "a+", flags: "g", sample: "aaa" });
    const worker = FakeWorker.instances[0];
    worker.respond({ output: "matched" });

    await expect(result).resolves.toBe("matched");
    expect(worker.terminated).toBe(true);
  });

  it("terminates regex execution after the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);

    const result = runRegexInWorker(
      { pattern: "(a+)+$", flags: "g", sample: "a".repeat(10_000) },
      25,
    );
    const worker = FakeWorker.instances[0];
    const rejection = expect(result).rejects.toThrow("正则执行超时");
    await vi.advanceTimersByTimeAsync(25);

    await rejection;
    expect(worker.terminated).toBe(true);
  });
});
