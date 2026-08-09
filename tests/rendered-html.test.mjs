import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Sandbox 2.0 foundation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Sandbox 2\.0 \| American Electorate Laboratory<\/title>/i);
  assert.match(html, /Change the electorate\. Trace every consequence\./);
  assert.match(html, /No changes means the exact actual result\./);
  assert.match(html, /Interface prototype only\./);
  assert.match(html, /This is not a forecast\./);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("renders baseline Electoral College values and accessible controls", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, />226</);
  assert.match(html, />312</);
  assert.match(html, /aria-label="Map view"/);
  assert.match(html, /aria-label="Pennsylvania age 18 to 29 turnout change"/);
  assert.match(html, /type="range"/);
  assert.match(html, /Apply assumption/);
  assert.match(html, /Reset/);
});
