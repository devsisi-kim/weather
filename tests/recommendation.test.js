import test from "node:test";
import assert from "node:assert/strict";
import { recommendOutfit, selectTemperatureBand } from "../src/recommendation.js";

test("기온 30도는 고온 밴드를 선택", () => {
  const band = selectTemperatureBand(30);
  assert.equal(band.key, "hot");
});

test("UV 높고 비 확률이 높으면 모자/선크림/우산 추천", () => {
  const result = recommendOutfit({
    tempC: 26,
    humidity: 70,
    uvIndex: 7,
    precipitationMm: 0.0,
    precipitationProbability: 80,
  });

  assert.ok(result.accessories.includes("선크림"));
  assert.ok(result.accessories.includes("모자"));
  assert.ok(result.accessories.includes("우산"));
});

test("저온에서는 보온 소품을 추천", () => {
  const result = recommendOutfit({
    tempC: 2,
    humidity: 40,
    uvIndex: 1,
    precipitationMm: 0.0,
    precipitationProbability: 0,
  });

  assert.ok(result.accessories.includes("목도리"));
  assert.ok(result.accessories.includes("장갑"));
  assert.equal(result.outfitLabel, "패딩/두꺼운 코트");
});
