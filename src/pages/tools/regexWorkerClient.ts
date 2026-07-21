import type { RegexWorkerRequest, RegexWorkerResponse } from "./regexWorker";

export const REGEX_EXECUTION_TIMEOUT_MS = 1_500;

export function runRegexInWorker(
  request: RegexWorkerRequest,
  timeoutMs = REGEX_EXECUTION_TIMEOUT_MS,
) {
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(new URL("./regexWorker.ts", import.meta.url), {
      type: "module",
    });
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(timeoutId);
      worker.terminate();
      callback();
    };

    const timeoutId = globalThis.setTimeout(() => {
      finish(() => reject(new Error("正则执行超时，请简化表达式或缩短测试文本")));
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<RegexWorkerResponse>) => {
      const response = event.data;
      if (typeof response.error === "string") {
        finish(() => reject(new Error(response.error)));
        return;
      }
      if (typeof response.output !== "string") {
        finish(() => reject(new Error("正则执行返回了无效结果")));
        return;
      }
      finish(() => resolve(response.output));
    };
    worker.onerror = () => {
      finish(() => reject(new Error("正则执行失败")));
    };
    worker.postMessage(request);
  });
}
