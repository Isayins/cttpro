import { buildRegexOutput } from "./toolUtils";

export type RegexWorkerRequest = {
  pattern: string;
  flags: string;
  sample: string;
};

export type RegexWorkerResponse =
  | { output: string; error?: never }
  | { output?: never; error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<RegexWorkerRequest>) => void) | null;
  postMessage: (response: RegexWorkerResponse) => void;
};

workerScope.onmessage = (event) => {
  try {
    workerScope.postMessage({
      output: buildRegexOutput(
        event.data.pattern,
        event.data.flags,
        event.data.sample,
      ),
    });
  } catch (error) {
    workerScope.postMessage({
      error: error instanceof Error ? error.message : "正则测试失败",
    });
  }
};
