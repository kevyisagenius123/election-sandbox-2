export function createReplayWorker() {
  return new Worker(
    new URL("./replayRuntime.worker.ts", import.meta.url),
    { type: "module", name: "election-replay-runtime" },
  );
}
