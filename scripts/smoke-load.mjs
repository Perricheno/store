// A short, read-only check of the local production API; never targets a public host.
import { performance } from "node:perf_hooks";

const concurrency = 3;
const durationMs = 5000;
const samples = [];
let errors = 0;
const start = performance.now();
const until = start + durationMs;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (performance.now() < until) {
      const before = performance.now();
      try {
        const response = await fetch(
          "http://127.0.0.1:8080/api/products?pageSize=24",
          {
            headers: { Host: "u.perricheno.com" },
            signal: AbortSignal.timeout(10000),
          },
        );
        const result = await response.json();
        if (
          !response.ok ||
          !Array.isArray(result.products) ||
          result.products.length > 24
        )
          errors++;
      } catch {
        errors++;
      }
      samples.push(performance.now() - before);
    }
  }),
);
samples.sort((a, b) => a - b);
const percentile = (p) =>
  Math.round(
    samples[Math.min(samples.length - 1, Math.ceil(samples.length * p) - 1)] ||
      0,
  );
console.log(
  JSON.stringify({
    concurrency,
    requests: samples.length,
    errors,
    elapsedMs: Math.round(performance.now() - start),
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: percentile(1),
  }),
);
if (errors) process.exitCode = 1;
