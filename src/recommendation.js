export const OUTFIT_BANDS = [
  {
    min: 28,
    key: "hot",
    label: "민소매/반팔 + 반바지",
    image: "assets/clothes/hot.png",
    items: ["민소매", "반팔", "반바지", "원피스"],
  },
  {
    min: 23,
    key: "warm",
    label: "반팔 + 얇은 셔츠",
    image: "assets/clothes/warm.png",
    items: ["반팔", "얇은 셔츠", "면바지"],
  },
  {
    min: 20,
    key: "mild",
    label: "긴팔/얇은 가디건",
    image: "assets/clothes/mild.png",
    items: ["긴팔", "얇은 가디건", "청바지"],
  },
  {
    min: 17,
    key: "cool",
    label: "니트/맨투맨",
    image: "assets/clothes/cool.png",
    items: ["얇은 니트", "맨투맨", "가디건", "청바지"],
  },
  {
    min: 12,
    key: "chilly",
    label: "자켓/후드",
    image: "assets/clothes/chilly.png",
    items: ["자켓", "후드", "면바지"],
  },
  {
    min: 9,
    key: "cold",
    label: "트렌치/야상",
    image: "assets/clothes/cold.png",
    items: ["트렌치코트", "야상", "니트"],
  },
  {
    min: 5,
    key: "very-cold",
    label: "코트/가죽자켓",
    image: "assets/clothes/very-cold.png",
    items: ["코트", "가죽자켓", "기모 바지"],
  },
  {
    min: -100,
    key: "freezing",
    label: "패딩/두꺼운 코트",
    image: "assets/clothes/freezing.png", // Will be generated soon
    items: ["패딩", "두꺼운 코트", "기모 제품"],
  },
];

export function selectTemperatureBand(tempC) {
  return OUTFIT_BANDS.find((band) => tempC >= band.min) || OUTFIT_BANDS[OUTFIT_BANDS.length - 1];
}

export function recommendOutfit({
  tempC,
  humidity,
  uvIndex,
  precipitationMm,
  precipitationProbability,
  temperatureRange,
  pm25,
  pm10,
  airQualityIndex,
}) {
  const band = selectTemperatureBand(tempC);
  const accessories = [];
  const notes = [];

  if (uvIndex >= 3) {
    accessories.push("선크림");
    notes.push("UV가 높아 자외선 차단이 필요합니다.");
  }

  if (uvIndex >= 6) {
    accessories.push("모자");
    notes.push("한낮 외출 시 모자를 권장합니다.");
  }

  if (precipitationProbability >= 50 || precipitationMm >= 0.2) {
    accessories.push("우산");
    notes.push("강수 가능성이 있어 우산을 챙기세요.");
  }

  if (tempC <= 8) {
    accessories.push("목도리", "장갑");
    notes.push("기온이 낮아 보온 소품이 필요합니다.");
  }

  if (humidity >= 80 && tempC >= 23) {
    notes.push("습도가 높아 통기성 좋은 소재를 권장합니다.");
  }

  if (
    (typeof pm25 === "number" && pm25 >= 35) ||
    (typeof pm10 === "number" && pm10 >= 80) ||
    (typeof airQualityIndex === "number" && airQualityIndex >= 80)
  ) {
    accessories.push("마스크");
    notes.push("대기질이 좋지 않아 마스크 착용을 권장합니다.");
  }

  if (typeof temperatureRange === "number" && temperatureRange >= 10) {
    accessories.push("머플러");
    notes.push("일교차가 커서 보온용 소품이 필요할 수 있습니다.");
  }

  return {
    outfitLabel: band.label,
    image: band.image,
    items: band.items,
    accessories: [...new Set(accessories)],
    notes,
  };
}
