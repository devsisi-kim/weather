import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createWeatherServer } from "../src/server/app-server.js";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

function buildMockFetch() {
  return async function mockFetch(url) {
    const target = typeof url === "string" ? new URL(url) : url;

    if (target.hostname === "geocoding-api.open-meteo.com") {
      const name = target.searchParams.get("name") || "Unknown";
      return jsonResponse({
        results: [{ name, latitude: 35.0, longitude: 128.0 }],
      });
    }

    if (target.hostname === "api.open-meteo.com") {
      return jsonResponse({
        current: {
          temperature_2m: 26,
          relative_humidity_2m: 65,
          uv_index: 7,
          precipitation: 0.1,
        },
        daily: {
          precipitation_probability_max: [60, 40],
          temperature_2m_max: [28, 24],
          temperature_2m_min: [18, 14],
        },
      });
    }

    return jsonResponse({ message: "Not found" }, 404);
  };
}

function requestJson(port, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path: pathname,
        headers: payload
          ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          }
          : undefined,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          const parsed = raw ? JSON.parse(raw) : {};
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function withServer(run) {
  const server = createWeatherServer({ fetchImpl: buildMockFetch() });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    await run({ port });
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test("POST /api/recommendations returns cards with recommendation", async () => {
  await withServer(async ({ port }) => {
    const locations = [
      { id: "test-1", name: "Seoul", latitude: 37.5, longitude: 127.0 },
      { id: "test-2", name: "Busan", latitude: 35.1, longitude: 129.0 }
    ];

    const response = await requestJson(port, "POST", "/api/recommendations", { locations });

    assert.equal(response.status, 200);
    assert.equal(response.body.cards.length, 2);
    assert.ok(response.body.cards[0].recommendation);
    assert.ok(Array.isArray(response.body.cards[0].recommendation.items));
    assert.equal(response.body.cards[0].name, "Seoul");
    assert.equal(response.body.cards[1].name, "Busan");
  });
});
