export const OUTFIT_BANDS = [
  {
    min: 28,
    key: "hot",
    label: "민소매/반팔 + 반바지",
    image: "assets/clothes/hot.png",
    items: ["민소매", "반팔", "반바지", "린넨 옷"],
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
    items: ["긴팔", "얇은 가디건", "긴바지"],
  },
  {
    min: 17,
    key: "cool",
    label: "니트/맨투맨",
    image: "assets/clothes/cool.png",
    items: ["얇은 니트", "맨투맨", "가디건", "긴바지"],
  },
  {
    min: 12,
    key: "chilly",
    label: "자켓/후드",
    image: "assets/clothes/chilly.png",
    items: ["자켓", "후드", "니트", "긴바지"],
  },
  {
    min: 9,
    key: "cold",
    label: "트렌치/야상",
    image: "assets/clothes/cold.png",
    items: ["자켓", "트렌치코트", "니트", "기모 바지"],
  },
  {
    min: 5,
    key: "very-cold",
    label: "코트/히트텍",
    image: "assets/clothes/very-cold.png",
    items: ["코트", "히트텍", "기모 바지"],
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
  const accessoriesMap = new Map();
  const addAccessory = (name, note) => {
    if (!accessoriesMap.has(name)) accessoriesMap.set(name, note);
  };

  const outfitNotes = [];

  if (uvIndex >= 3) {
    addAccessory("선크림", "UV가 높아 자외선 차단이 필요합니다.");
  }

  if (uvIndex >= 6) {
    addAccessory("모자", "한낮 외출 시 모자를 권장합니다.");
    addAccessory("양산", "한낮 외출 시 양산을 권장합니다.");
    addAccessory("선글라스", "한낮 외출 시 선글라스를 권장합니다.");
  }

  if (uvIndex >= 10) {
    addAccessory("모자", "한낮 외출을 자제하세요.");
    addAccessory("양산", "한낮 외출을 자제하세요.");
    addAccessory("선글라스", "한낮 외출을 자제하세요.");
  }

  if (precipitationProbability >= 50 || precipitationMm >= 0.2) {
    addAccessory("우산", "강수 가능성이 있어 우산을 챙기세요.");
  }

  if (tempC <= 8) {
    addAccessory("목도리", "기온이 낮아 보온 소품이 필요합니다.");
    addAccessory("장갑", "기온이 낮아 보온 소품이 필요합니다.");
  }

  if (humidity >= 80 && tempC >= 23) {
    outfitNotes.push("습도가 높아 통기성 좋은 소재를 권장합니다.");
  }

  if (
    (typeof pm25 === "number" && pm25 >= 35) ||
    (typeof pm10 === "number" && pm10 >= 80) ||
    (typeof airQualityIndex === "number" && airQualityIndex >= 80)
  ) {
    addAccessory("마스크", "대기질이 좋지 않습니다.");
  }

  if (typeof temperatureRange === "number" && temperatureRange >= 10) {
    addAccessory("머플러", "일교차가 큽니다.");
  }

  const itemsWithNotes = band.items.map(item => ({ name: item, note: outfitNotes.join(" ") || null }));
  const accessoriesWithNotes = Array.from(accessoriesMap.entries()).map(([name, note]) => ({ name, note }));

  return {
    outfitLabel: band.label,
    image: band.image,
    items: itemsWithNotes,
    accessories: accessoriesWithNotes,
  };
}
