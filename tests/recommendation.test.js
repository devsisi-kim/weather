import test from "node:test";
import assert from "node:assert/strict";
import { recommendOutfit, selectTemperatureBand } from "../src/recommendation.js";

test("기온 30도는 고온 밴드를 선택", () => {
  const band = selectTemperatureBand(30);
  assert.equal(band.key, "hot");
});

test("UV 높고 비 확률이 높으면 모자/선크림/우산 추천(현재 UV가 낮아도 uvMax가 높으면 발동)", () => {
  const result = recommendOutfit({
    tempC: 26,
    humidity: 70,
    uvIndex: 1, // 야간 등 현재값이 낮은 상황 모사
    uvMax: 7,   // 일중 최고는 높음
    uvPeakHour: 14,
    precipitationMm: 0.0,
    precipitationProbability: 80,
    lang: "ko"
  });

  assert.ok(result.accessories.some(a => a.name === "선크림"));
  assert.ok(result.accessories.some(a => a.name === "모자"));
  assert.ok(result.accessories.some(a => a.name === "우산"));
});

test("영어(en) 설정 시 악세사리 및 옷차림이 다국어 번역되어 반환된다", () => {
  const result = recommendOutfit({
    tempC: 26,
    humidity: 70,
    uvIndex: 1,
    uvMax: 7,
    uvPeakHour: 14,
    precipitationMm: 0.0,
    precipitationProbability: 80,
    lang: "en"
  });

  assert.ok(result.accessories.some(a => a.name === "Sunscreen"));
  assert.ok(result.accessories.some(a => a.name === "Hat"));
  assert.ok(result.accessories.some(a => a.name === "Umbrella"));
  assert.ok(result.outfitLabel === "Sleeveless/Shorts" || result.outfitLabel === "Short-sleeve + Light shirt");
});

test("저온에서는 보온 소품을 추천", () => {
  const result = recommendOutfit({
    tempC: 2,
    humidity: 40,
    uvIndex: 1,
    precipitationMm: 0.0,
    precipitationProbability: 0,
  });

  assert.ok(result.accessories.some(a => a.name === "목도리"));
  assert.ok(result.accessories.some(a => a.name === "장갑"));
  assert.equal(result.outfitLabel, "패딩/두꺼운 코트");
});

// ── 추가 케이스 ──────────────────────────────────────────────

test("pm25 >= 35이면 마스크 추천", () => {
  const result = recommendOutfit({
    tempC: 20,
    humidity: 50,
    uvIndex: 2,
    precipitationMm: 0,
    precipitationProbability: 0,
    pm25: 40,
  });
  assert.ok(result.accessories.some(a => a.name === "마스크"));
});

test("pm10 >= 80이어도 마스크 추천", () => {
  const result = recommendOutfit({
    tempC: 20,
    humidity: 50,
    uvIndex: 2,
    precipitationMm: 0,
    precipitationProbability: 0,
    pm10: 85,
  });
  assert.ok(result.accessories.some(a => a.name === "마스크"));
});

test("일교차 >= 10이면 머플러 추천", () => {
  const result = recommendOutfit({
    tempC: 15,
    humidity: 50,
    uvIndex: 2,
    precipitationMm: 0,
    precipitationProbability: 0,
    temperatureRange: 12,
  });
  assert.ok(result.accessories.some(a => a.name === "머플러"));
});

test("경계 기온 28도 → hot 밴드 (hot.min=28)", () => {
  const band = selectTemperatureBand(28);
  assert.equal(band.key, "hot");
});

test("경계 기온 12도 → chilly 밴드", () => {
  const band = selectTemperatureBand(12);
  assert.equal(band.key, "chilly");
});

test("경계 기온 5도 → very-cold 밴드", () => {
  const band = selectTemperatureBand(5);
  assert.equal(band.key, "very-cold");
});
