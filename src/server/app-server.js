import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recommendOutfit } from "../recommendation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function json(res, code, payload) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function text(res, code, payload) {
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(payload);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("요청 본문이 너무 큽니다."));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON 본문 형식이 올바르지 않습니다."));
      }
    });
    req.on("error", reject);
  });
}

async function ensureDataFile(dataFile) {
  const dir = path.dirname(dataFile);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    const seed = [
      { id: crypto.randomUUID(), name: "Seoul", latitude: 37.5665, longitude: 126.978 },
      { id: crypto.randomUUID(), name: "Busan", latitude: 35.1796, longitude: 129.0756 },
    ];
    await fs.writeFile(dataFile, JSON.stringify(seed, null, 2), "utf-8");
  }
}

async function loadLocations(dataFile) {
  await ensureDataFile(dataFile);
  const raw = await fs.readFile(dataFile, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.slice(0, 2) : [];
}

async function saveLocations(dataFile, locations) {
  await fs.writeFile(dataFile, JSON.stringify(locations.slice(0, 2), null, 2), "utf-8");
}

async function geocodeLocation(fetchImpl, query) {
  const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
  endpoint.searchParams.set("name", query);
  endpoint.searchParams.set("count", "1");
  endpoint.searchParams.set("language", "en");

  const response = await fetchImpl(endpoint);
  if (!response.ok) {
    throw new Error("위치 검색 API 요청에 실패했습니다.");
  }

  const data = await response.json();
  const first = data?.results?.[0];
  if (!first) {
    throw new Error("위치를 찾지 못했습니다.");
  }

  return {
    id: crypto.randomUUID(),
    name: first.name,
    latitude: first.latitude,
    longitude: first.longitude,
  };
}

async function fetchCurrentWeather(fetchImpl, { latitude, longitude }) {
  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  endpoint.searchParams.set("latitude", String(latitude));
  endpoint.searchParams.set("longitude", String(longitude));
  endpoint.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,uv_index,precipitation",
  );
  endpoint.searchParams.set(
    "daily",
    "precipitation_probability_max,temperature_2m_max,temperature_2m_min",
  );
  endpoint.searchParams.set("hourly", "temperature_2m");
  endpoint.searchParams.set("forecast_days", "2");
  endpoint.searchParams.set("timezone", "auto");

  const response = await fetchImpl(endpoint);
  if (!response.ok) {
    throw new Error("날씨 API 요청에 실패했습니다.");
  }

  const data = await response.json();
  if (!data?.current || !data?.daily) {
    throw new Error("날씨 데이터 형식이 올바르지 않습니다.");
  }

  const temperatureRange = resolveTemperatureRange(data);

  const tomorrowMax = data.daily.temperature_2m_max?.[1] ?? null;
  const tomorrowMin = data.daily.temperature_2m_min?.[1] ?? null;
  const tomorrowPrecip = data.daily.precipitation_probability_max?.[1] ?? null;

  return {
    tempC: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    uvIndex: data.current.uv_index,
    precipitationMm: data.current.precipitation,
    precipitationProbability: data.daily.precipitation_probability_max?.[0] ?? 0,
    temperatureRange,
    pm25: null,
    pm10: null,
    airQualityIndex: null,
    updatedAt: data.current.time ?? new Date().toISOString(),
    timezone: data.timezone ?? null,
    tomorrow: {
      tempMax: tomorrowMax,
      tempMin: tomorrowMin,
      tempAvg: tomorrowMax != null && tomorrowMin != null ? Number(((tomorrowMax + tomorrowMin) / 2).toFixed(1)) : null,
      precipitationProbability: tomorrowPrecip,
    },
  };
}

function resolveTemperatureRange(data) {
  const dailyMax = data?.daily?.temperature_2m_max?.[0];
  const dailyMin = data?.daily?.temperature_2m_min?.[0];

  if (typeof dailyMax === "number" && typeof dailyMin === "number") {
    return dailyMax - dailyMin;
  }

  const hourlyTemps = Array.isArray(data?.hourly?.temperature_2m) ? data.hourly.temperature_2m : [];
  if (hourlyTemps.length === 0) {
    return null;
  }

  const validTemps = hourlyTemps.filter((value) => typeof value === "number");
  if (validTemps.length === 0) {
    return null;
  }

  const maxTemp = Math.max(...validTemps);
  const minTemp = Math.min(...validTemps);
  return maxTemp - minTemp;
}

async function fetchAirQuality(fetchImpl, { latitude, longitude, timezone }) {
  const endpoint = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  endpoint.searchParams.set("latitude", String(latitude));
  endpoint.searchParams.set("longitude", String(longitude));
  endpoint.searchParams.set("current", "pm2_5,pm10,us_aqi");
  endpoint.searchParams.set("timezone", timezone || "auto");

  const response = await fetchImpl(endpoint);
  if (!response.ok) {
    return fetchAirQualityFromHourly(fetchImpl, { latitude, longitude, timezone });
  }

  const data = await response.json();
  if (data?.current) {
    return {
      pm25: typeof data.current.pm2_5 === "number" ? data.current.pm2_5 : null,
      pm10: typeof data.current.pm10 === "number" ? data.current.pm10 : null,
      airQualityIndex: typeof data.current.us_aqi === "number" ? data.current.us_aqi : null,
    };
  }

  return fetchAirQualityFromHourly(fetchImpl, { latitude, longitude, timezone });
}

async function fetchAirQualityFromHourly(fetchImpl, { latitude, longitude, timezone }) {
  const endpoint = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  endpoint.searchParams.set("latitude", String(latitude));
  endpoint.searchParams.set("longitude", String(longitude));
  endpoint.searchParams.set("hourly", "pm2_5,pm10,us_aqi");
  endpoint.searchParams.set("timezone", timezone || "auto");

  const response = await fetchImpl(endpoint);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const times = Array.isArray(data?.hourly?.time) ? data.hourly.time : [];
  const pm25History = Array.isArray(data?.hourly?.pm2_5) ? data.hourly.pm2_5 : [];
  const pm10History = Array.isArray(data?.hourly?.pm10) ? data.hourly.pm10 : [];
  const aqiHistory = Array.isArray(data?.hourly?.us_aqi) ? data.hourly.us_aqi : [];

  const target = new Date();
  const targetTs = target.getTime();
  let bestIndex = 0;

  if (times.length > 0) {
    let bestGap = Number.POSITIVE_INFINITY;
    times.forEach((timeValue, index) => {
      const timeTs = new Date(timeValue).getTime();
      const gap = Math.abs(timeTs - targetTs);
      if (!Number.isNaN(timeTs) && gap < bestGap) {
        bestGap = gap;
        bestIndex = index;
      }
    });
  }

  const pm25 = pm25History[bestIndex];
  const pm10 = pm10History[bestIndex];
  const airQualityIndex = aqiHistory[bestIndex];

  if (pm25 == null && pm10 == null && airQualityIndex == null) {
    return null;
  }

  return {
    pm25: typeof pm25 === "number" ? pm25 : null,
    pm10: typeof pm10 === "number" ? pm10 : null,
    airQualityIndex: typeof airQualityIndex === "number" ? airQualityIndex : null,
  };
}

function coerceTemperatureRange(rawRange) {
  if (typeof rawRange !== "number" || Number.isNaN(rawRange)) {
    return null;
  }
  return Number(rawRange.toFixed(1));
}

function buildFallbackWeather(reason = "외부 날씨 API 연결 실패") {
  return {
    tempC: 22,
    humidity: 55,
    uvIndex: 3,
    precipitationMm: 0,
    precipitationProbability: 10,
    temperatureRange: 7,
    pm25: null,
    pm10: null,
    airQualityIndex: null,
    updatedAt: new Date().toISOString(),
    timezone: null,
    source: "fallback",
    sourceMessage: reason,
  };
}

async function fetchAirQualityFromWaqi(fetchImpl, { latitude, longitude }) {
  const token = process.env.WAQI_TOKEN || "demo";
  const endpoint = new URL(`https://api.waqi.info/feed/geo:${latitude};${longitude}/`);
  endpoint.searchParams.set("token", token);

  const response = await fetchImpl(endpoint);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data || data.status !== "ok" || !data.data) {
    return null;
  }

  const aqi = data.data.aqi;
  const iaqi = data.data.iaqi ?? {};

  return {
    pm25:
      typeof iaqi.pm25?.v === "number"
        ? iaqi.pm25.v
        : typeof iaqi["p2"]?.v === "number"
          ? iaqi["p2"].v
          : null,
    pm10: typeof iaqi.pm10?.v === "number" ? iaqi.pm10.v : null,
    airQualityIndex: typeof aqi === "number" ? aqi : null,
  };
}

function safeFilePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  const target = pathname === "/" ? "/index.html" : pathname;
  const fullPath = path.resolve(PROJECT_ROOT, `.${target}`);

  if (!fullPath.startsWith(PROJECT_ROOT)) {
    return null;
  }

  if (fullPath.includes(`${path.sep}data${path.sep}`)) {
    return null;
  }

  return fullPath;
}

async function serveStatic(req, res) {
  const fullPath = safeFilePath(req.url || "/");
  if (!fullPath) {
    text(res, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fs.stat(fullPath);
    if (!stats.isFile()) {
      text(res, 404, "Not Found");
      return;
    }

    const ext = path.extname(fullPath);
    const type = STATIC_TYPES[ext] || "application/octet-stream";
    const content = await fs.readFile(fullPath);
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  } catch {
    text(res, 404, "Not Found");
  }
}

export function createWeatherServer({
  dataFile = path.resolve(PROJECT_ROOT, "data", "locations.json"),
  fetchImpl = fetch,
} = {}) {
  const server = http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const urlPath = req.url || "/";

    try {
      if (urlPath === "/api/health" && method === "GET") {
        json(res, 200, { ok: true });
        return;
      }

      if (urlPath === "/api/locations" && method === "GET") {
        const locations = await loadLocations(dataFile);
        json(res, 200, { locations });
        return;
      }

      if (urlPath === "/api/locations" && method === "POST") {
        const body = await parseRequestBody(req);
        const query = String(body.query || "").trim();

        if (!query) {
          json(res, 400, { message: "query 값이 필요합니다." });
          return;
        }

        const locations = await loadLocations(dataFile);
        if (locations.length >= 2) {
          json(res, 400, { message: "위치는 최대 2개까지만 저장할 수 있습니다." });
          return;
        }

        const next = await geocodeLocation(fetchImpl, query);
        locations.push(next);
        await saveLocations(dataFile, locations);
        json(res, 201, { location: next, locations });
        return;
      }

      if (urlPath.startsWith("/api/locations/") && method === "DELETE") {
        const id = urlPath.split("/").pop();
        const locations = await loadLocations(dataFile);
        const filtered = locations.filter((item) => item.id !== id);

        await saveLocations(dataFile, filtered);
        json(res, 200, { locations: filtered });
        return;
      }

      if (urlPath === "/api/recommendations" && method === "GET") {
        const locations = await loadLocations(dataFile);
        const cards = await Promise.all(
          locations.map(async (location) => {
            let weather;
            let weatherSource = "live";

            try {
              weather = await fetchCurrentWeather(fetchImpl, location);
            } catch (error) {
              weather = buildFallbackWeather(error?.message || "외부 날씨 API 연결 실패");
              weatherSource = "fallback";
            }

            let airQuality = null;
            if (weatherSource === "live") {
              airQuality = await fetchAirQuality(fetchImpl, {
                latitude: location.latitude,
                longitude: location.longitude,
                timezone: weather.timezone,
              });
              if (!airQuality) {
                airQuality = await fetchAirQualityFromWaqi(fetchImpl, {
                  latitude: location.latitude,
                  longitude: location.longitude,
                });
              }
            }

            if (airQuality) {
              weather.pm25 = airQuality.pm25;
              weather.pm10 = airQuality.pm10;
              weather.airQualityIndex = airQuality.airQualityIndex;
            }

            if (typeof weather.temperatureRange === "number") {
              weather.temperatureRange = coerceTemperatureRange(weather.temperatureRange);
            }
            weather.updatedAt = weather.updatedAt || new Date().toISOString();
            const recommendation = recommendOutfit(weather);
            if (weatherSource === "fallback") {
              const fallbackMsg = "실시간 날씨 연결이 불안정해 임시 날씨 값으로 추천합니다.";
              if (recommendation.items && recommendation.items.length > 0) {
                recommendation.items[0].note = recommendation.items[0].note
                  ? fallbackMsg + " " + recommendation.items[0].note
                  : fallbackMsg;
              }
            }

            let tomorrowRecommendation = null;
            if (weather.tomorrow && weather.tomorrow.tempAvg != null) {
              tomorrowRecommendation = recommendOutfit({
                tempC: weather.tomorrow.tempAvg,
                humidity: weather.humidity,
                uvIndex: weather.uvIndex,
                precipitationMm: 0,
                precipitationProbability: weather.tomorrow.precipitationProbability ?? 0,
              });
            }

            return { ...location, weather, recommendation, tomorrowRecommendation };
          }),
        );

        json(res, 200, { cards, count: cards.length });
        return;
      }

      await serveStatic(req, res);
    } catch (error) {
      json(res, 500, { message: error?.message || "서버 오류가 발생했습니다." });
    }
  });

  return server;
}
