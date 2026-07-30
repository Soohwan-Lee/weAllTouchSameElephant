import assert from "node:assert/strict";
import {
  checkRateLimit,
  requestClientKey,
  utf8ByteLength,
} from "../src/lib/rateLimit.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("  ✓", name);
};

console.log("\nAPI guard");

check("rate limits are isolated by endpoint and reset after the window", () => {
  const now = 10_000;
  assert.equal(checkRateLimit("bridges-test", "client", now, 2, 1000).allowed, true);
  assert.equal(checkRateLimit("bridges-test", "client", now, 2, 1000).allowed, true);
  assert.equal(checkRateLimit("bridges-test", "client", now, 2, 1000).allowed, false);
  assert.equal(checkRateLimit("name-test", "client", now, 2, 1000).allowed, true);
  assert.equal(checkRateLimit("bridges-test", "client", now + 1000, 2, 1000).allowed, true);
});

check("the proxy-provided first client address is used consistently", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
  assert.equal(requestClientKey(headers), "203.0.113.7");
});

check("body sizing counts UTF-8 bytes rather than JavaScript code units", () => {
  assert.equal(utf8ByteLength("abc"), 3);
  assert.equal(utf8ByteLength("코끼리"), 9);
});

console.log(`\n${passed} API-guard assertions passed\n`);
