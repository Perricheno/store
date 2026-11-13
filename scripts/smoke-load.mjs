// A short, read-only check of the local production API; never targets a public host.
import { performance } from "node:perf_hooks";
import { request } from "node:http";

function getProducts() {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port: 8080,
        path: "/api/products?pageSize=24",
        headers: { Host: "u.perricheno.com" },
        timeout: 10000,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { body += chunk; });
        response.on("error", reject);
        response.on("end", () => {
          try {
            resolve({ status: response.statusCode, result: JSON.parse(body) });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}

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
        const { status, result } = await getProducts();
        if (
          status < 200 || status >= 300 ||
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
