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
          time: "2026-02-13T12:00:00+09:00",
        },
        daily: {
          precipitation_probability_max: [60],
        },
        hourly: {
          time: [
            "2026-02-13T08:00:00+09:00",
            "2026-02-13T09:00:00+09:00",
            "2026-02-13T10:00:00+09:00",
          ],
          temperature_2m: [15, 20, 24],
        },
      });
    }

    if (target.hostname === "air-quality-api.open-meteo.com") {
      return jsonResponse({
        hourly: {
          time: [
            "2026-02-13T11:00:00+09:00",
            "2026-02-13T12:00:00+09:00",
            "2026-02-13T13:00:00+09:00",
          ],
          pm2_5: [12, 16, 20],
          pm10: [18, 24, 30],
          us_aqi: [45, 52, 48],
        },
      });
    }

    if (target.hostname === "api.waqi.info") {
      return jsonResponse({
        status: "ok",
        data: {
          aqi: 50,
          iaqi: {
            pm25: { v: 18 },
            p2: { v: 18 },
            pm10: { v: 20 },
          },
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

async function run() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "weather-app-smoke-"));
  const dataFile = path.join(tmpDir, "locations.json");
  const server = createWeatherServer({ dataFile, fetchImpl: buildMockFetch() });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const locations = await requestJson(port, "GET", "/api/locations");
    assert.equal(locations.status, 200);
    assert.equal(locations.body.locations.length, 2);

    const thirdFail = await requestJson(port, "POST", "/api/locations", { query: "Tokyo" });
    assert.equal(thirdFail.status, 400);

    const firstId = locations.body.locations[0].id;
    const removed = await requestJson(port, "DELETE", `/api/locations/${firstId}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.locations.length, 1);

    const added = await requestJson(port, "POST", "/api/locations", { query: "Tokyo" });
    assert.equal(added.status, 201);
    assert.equal(added.body.locations.length, 2);

    const rec = await requestJson(port, "GET", "/api/recommendations");
    assert.equal(rec.status, 200);
    assert.ok(rec.body.cards.length > 0);
    assert.ok(rec.body.cards[0].recommendation.outfitLabel);
    assert.equal(typeof rec.body.cards[0].weather.temperatureRange, "number");
    assert.equal(rec.body.cards[0].weather.precipitationProbability, 60);
    assert.ok([12, 16, 20].includes(rec.body.cards[0].weather.pm25));
    assert.ok([45, 52, 48].includes(rec.body.cards[0].weather.airQualityIndex));
    assert.equal(typeof rec.body.cards[0].weather.updatedAt, "string");

    const saved = JSON.parse(await readFile(dataFile, "utf-8"));
    assert.equal(saved.length, 2);

    console.log("API smoke test passed");
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

run().catch((error) => {
  console.error("API smoke test failed", error);
  process.exit(1);
});
