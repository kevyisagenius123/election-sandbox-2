import type {
  ReplayWorkerRequest,
  ReplayWorkerResponse,
} from "./replayWorkerProtocol.ts";
import { ReplayWorkerRuntime } from "./replayWorkerRuntime.ts";

interface ReplayWorkerScope {
  onmessage: ((event: MessageEvent<ReplayWorkerRequest>) => void) | null;
  postMessage(message: ReplayWorkerResponse): void;
}

const workerScope = globalThis as unknown as ReplayWorkerScope;
const runtime = new ReplayWorkerRuntime();
let queue = Promise.resolve();

workerScope.onmessage = (event) => {
  const request = event.data;
  queue = queue.then(async () => {
    workerScope.postMessage(await runtime.handle(request));
  });
};
