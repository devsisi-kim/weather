import test from "node:test";
import assert from "node:assert/strict";
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

/** 정상 날씨 응답: today + tomorrow 포함 */
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
          time: "2026-03-03T09:00",
        },
        daily: {
          weather_code: [1, 61],
          precipitation_probability_max: [60, 40],
          temperature_2m_max: [28, 24],
          temperature_2m_min: [18, 14],
          uv_index_max: [7, 5],
          precipitation_sum: [0.5, 2.0],
        },
        hourly: {
          temperature_2m: Array(48).fill(22),
        },
        timezone: "Asia/Seoul",
      });
    }

    // 대기질 API는 빈 응답으로 처리
    return jsonResponse({ message: "Not found" }, 404);
  };
}

/** 날씨 API가 실패하는 mock */
function buildFailingWeatherFetch() {
  return async function mockFetch(url) {
    const target = typeof url === "string" ? new URL(url) : url;
    if (target.hostname === "api.open-meteo.com") {
      return jsonResponse({ message: "Service unavailable" }, 503);
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

async function withServer(fetchImpl, run) {
  const server = createWeatherServer({ fetchImpl });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    await run({ port });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

// ── 기존 케이스 ──────────────────────────────────────────────

test("POST /api/recommendations returns cards with recommendation", async () => {
  await withServer(buildMockFetch(), async ({ port }) => {
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

// ── 추가 케이스 ──────────────────────────────────────────────

test("tomorrow 날씨/추천이 응답에 포함된다", async () => {
  await withServer(buildMockFetch(), async ({ port }) => {
    const locations = [{ id: "t1", name: "Seoul", latitude: 37.5, longitude: 127.0 }];
    const response = await requestJson(port, "POST", "/api/recommendations", { locations });

    assert.equal(response.status, 200);
    const card = response.body.cards[0];

    // tomorrow 날씨 객체 존재 확인
    assert.ok(card.weather.tomorrow, "weather.tomorrow가 존재해야 함");
    assert.ok(card.weather.tomorrow.tempAvg != null, "명일 tempAvg가 있어야 함");
    assert.ok(card.weather.tomorrow.weatherDescription != null, "명일 weatherDescription이 있어야 함");

    // tomorrow 추천 존재 확인
    assert.ok(card.tomorrowRecommendation, "tomorrowRecommendation이 존재해야 함");
    assert.ok(Array.isArray(card.tomorrowRecommendation.items), "tomorrowRecommendation.items가 배열이어야 함");
  });
});

test("tomorrow weatherDescription은 weather_code 61(비)에 맞게 Rain", async () => {
  await withServer(buildMockFetch(), async ({ port }) => {
    const locations = [{ id: "t1", name: "Seoul", latitude: 37.5, longitude: 127.0 }];
    const response = await requestJson(port, "POST", "/api/recommendations", { locations });

    const tomorrow = response.body.cards[0].weather.tomorrow;
    assert.equal(tomorrow.weatherDescription, "Rain"); // weather_code[1] = 61 → Rain
  });
});

test("날씨 API 실패 시 fallback으로 응답되고 500을 반환하지 않는다", async () => {
  await withServer(buildFailingWeatherFetch(), async ({ port }) => {
    const locations = [{ id: "t1", name: "Seoul", latitude: 37.5, longitude: 127.0 }];
    const response = await requestJson(port, "POST", "/api/recommendations", { locations });

    assert.equal(response.status, 200, "fallback이어도 200을 반환해야 함");
    const card = response.body.cards[0];
    assert.equal(card.weather.source, "fallback", "source가 fallback이어야 함");
    assert.ok(card.recommendation, "fallback 상태에서도 recommendation이 존재해야 함");
  });
});

test("GET /api/health → { ok: true }", async () => {
  await withServer(buildMockFetch(), async ({ port }) => {
    const response = await requestJson(port, "GET", "/api/health", null);
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
  });
});
