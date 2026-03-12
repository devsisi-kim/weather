export const OUTFIT_BANDS = [
  {
    min: 28,
    key: "hot",
    label: { ko: "민소매/반팔 + 반바지", en: "Sleeveless/Shorts" },
    image: "assets/clothes/hot.png",
    items: { ko: ["민소매", "반팔", "반바지", "린넨 옷"], en: ["Sleeveless", "Short-sleeve", "Shorts", "Linen"] },
  },
  {
    min: 23,
    key: "warm",
    label: { ko: "반팔 + 얇은 셔츠", en: "Short-sleeve + Light shirt" },
    image: "assets/clothes/warm.png",
    items: { ko: ["반팔", "얇은 셔츠", "면바지"], en: ["Short-sleeve", "Light shirt", "Cotton pants"] },
  },
  {
    min: 20,
    key: "mild",
    label: { ko: "긴팔/얇은 가디건", en: "Long-sleeve/Light cardigan" },
    image: "assets/clothes/mild.png",
    items: { ko: ["긴팔", "얇은 가디건", "긴바지"], en: ["Long-sleeve", "Light cardigan", "Pants"] },
  },
  {
    min: 17,
    key: "cool",
    label: { ko: "니트/맨투맨", en: "Knit/Sweatshirt" },
    image: "assets/clothes/cool.png",
    items: { ko: ["얇은 니트", "맨투맨", "가디건", "긴바지"], en: ["Light knit", "Sweatshirt", "Cardigan", "Pants"] },
  },
  {
    min: 12,
    key: "chilly",
    label: { ko: "자켓/후드", en: "Jacket/Hoodie" },
    image: "assets/clothes/chilly.png",
    items: { ko: ["자켓", "후드", "니트", "긴바지"], en: ["Jacket", "Hoodie", "Knit", "Pants"] },
  },
  {
    min: 9,
    key: "cold",
    label: { ko: "트렌치/야상", en: "Trench/Field jacket" },
    image: "assets/clothes/cold.png",
    items: { ko: ["자켓", "트렌치코트", "니트", "기모 바지"], en: ["Jacket", "Trench coat", "Knit", "Fleece pants"] },
  },
  {
    min: 5,
    key: "very-cold",
    label: { ko: "코트/히트텍", en: "Coat/Thermal inner" },
    image: "assets/clothes/very-cold.png",
    items: { ko: ["코트", "히트텍", "기모 바지"], en: ["Coat", "Thermal inner", "Fleece pants"] },
  },
  {
    min: -100,
    key: "freezing",
    label: { ko: "패딩/두꺼운 코트", en: "Puffer/Heavy coat" },
    image: "assets/clothes/freezing.png",
    items: { ko: ["패딩", "두꺼운 코트", "기모 제품"], en: ["Puffer", "Heavy coat", "Fleece-lined"] },
  },
];

export function selectTemperatureBand(tempC) {
  return OUTFIT_BANDS.find((band) => tempC >= band.min) || OUTFIT_BANDS[OUTFIT_BANDS.length - 1];
}

export function recommendOutfit({
  tempC,
  humidity,
  uvIndex,
  uvMax,
  uvPeakHour,
  precipitationMm,
  precipitationProbability,
  temperatureRange,
  pm25,
  pm10,
  airQualityIndex,
  lang = "ko"
}) {
  const band = selectTemperatureBand(tempC);
  const accessoriesMap = new Map();
  const addAccessory = (name, note) => {
    if (!accessoriesMap.has(name)) accessoriesMap.set(name, note);
  };

  const t = (koStr, enStr) => lang === "en" ? enStr : koStr;
  const outfitNotes = [];

  const targetUv = uvMax != null ? uvMax : uvIndex;
  const peakTimeText = uvPeakHour != null ? t(`(오후 ${uvPeakHour}시 피크)`, ` (Peak: ${uvPeakHour}:00)`) : "";

  if (targetUv >= 3 && targetUv < 6) {
    addAccessory(t("선크림", "Sunscreen"), t(`UV가 다소 높습니다${peakTimeText}. 자외선 차단이 필요합니다.`, `Moderate UV${peakTimeText}. Sun protection recommended.`));
  }

  if (targetUv >= 6 && targetUv < 10) {
    addAccessory(t("선크림", "Sunscreen"), t(`UV가 높습니다${peakTimeText}. 자외선 차단이 필수입니다.`, `High UV${peakTimeText}. Sun protection essential.`));
    addAccessory(t("모자", "Hat"), t("한낮 외출 시 모자를 권장합니다.", "Recommended for daytime outings."));
    addAccessory(t("양산", "Parasol"), t("한낮 외출 시 양산을 권장합니다.", "Recommended for daytime outings."));
    addAccessory(t("선글라스", "Sunglasses"), t("한낮 외출 시 선글라스를 권장합니다.", "Recommended for daytime outings."));
  }

  if (targetUv >= 10) {
    addAccessory(t("선크림", "Sunscreen"), t(`UV가 매우 높습니다${peakTimeText}. 자외선 차단이 필수입니다.`, `Very high UV${peakTimeText}. Sun protection essential.`));
    addAccessory(t("모자", "Hat"), t("한낮 외출을 자제하세요.", "Avoid daytime outings."));
    addAccessory(t("양산", "Parasol"), t("한낮 외출을 자제하세요.", "Avoid daytime outings."));
    addAccessory(t("선글라스", "Sunglasses"), t("한낮 외출을 자제하세요.", "Avoid daytime outings."));
  }

  if (precipitationProbability >= 50 || precipitationMm >= 0.2) {
    addAccessory(t("우산", "Umbrella"), t("강수 가능성이 있어 우산을 챙기세요.", "Rain expected. Bring an umbrella."));
  }

  if (tempC <= 8) {
    addAccessory(t("목도리", "Scarf"), t("기온이 낮아 보온 소품이 필요합니다.", "Low temp. Keep warm."));
    addAccessory(t("장갑", "Gloves"), t("기온이 낮아 보온 소품이 필요합니다.", "Low temp. Keep warm."));
  }

  if (humidity >= 80 && tempC >= 23) {
    outfitNotes.push(t("습도가 높아 통기성 좋은 소재를 권장합니다.", "High humidity. Breathable materials recommended."));
  }

  if (
    (typeof pm25 === "number" && pm25 >= 35) ||
    (typeof pm10 === "number" && pm10 >= 80) ||
    (typeof airQualityIndex === "number" && airQualityIndex >= 80)
  ) {
    addAccessory(t("마스크", "Mask"), t("대기질이 좋지 않습니다.", "Poor air quality."));
  }

  if (typeof temperatureRange === "number" && temperatureRange >= 10) {
    addAccessory(t("머플러", "Scarf"), t("일교차가 큽니다.", "Large temperature difference today."));
  }

  const itemsWithNotes = band.items[lang].map(item => ({ name: item, note: outfitNotes.join(" ") || null }));
  const accessoriesWithNotes = Array.from(accessoriesMap.entries()).map(([name, note]) => ({ name, note }));

  return {
    outfitLabel: band.label[lang],
    image: band.image,
    items: itemsWithNotes,
    accessories: accessoriesWithNotes,
  };
}
