const lang = navigator.language.startsWith("ko") ? "ko" : "en";

const i18n = {
  ko: {
    today: "오늘",
    tomorrow: "내일",
    searchPlaceholder: "위치 추가: 예) Seoul, Tokyo",
    searchEmpty: "검색 결과가 없습니다.",
    locMax: "위치는 최대 2개까지만 저장할 수 있습니다.",
    locAddSuccess: "위치 추가 완료",
    locLoading: "위치 검색 중...",
    locFail: "위치를 찾지 못했습니다.",
    locLoadFail: "로컬 위치 목록 조회 실패",
    refreshing: "날씨 및 추천 갱신 중...",
    reqLoc: "위치를 추가해주세요.",
    recFail: "추천 조회에 실패했습니다.",
    upToDate: "추천이 최신 상태입니다.",
    emptyCards: "위치를 추가하면 추천이 표시됩니다.",
    precipProb: "강수확률",
    tempRange: "일교차",
    low: "최저",
    high: "최고",
    dataFallback: "임시",
    connFail: "연결 실패",
    dataLive: "실시간 기준",
    noData: "미확인",
    dataFormatError: "데이터 형식 오류",
    outfit: "옷차림",
    accessories: "액세서리",
    // metrics
    temp0: "영하권: 보온이 우선입니다",
    temp8: "매우 쌀쌀: 겉옷 강화",
    temp15: "서늘: 레이어링 권장",
    temp24: "쾌적: 기본 복장",
    tempHot: "더움: 통기성 필수",
    hum40: "건조: 보습 필요",
    hum60: "적당: 쾌적한 구간",
    hum75: "습함: 땀 관리 필요",
    humHumid: "높은 습도: 통기성 중요",
    uv3: "낮음",
    uv5: "보통",
    uv8: "높음: 자외선 대비",
    uvVeryHigh: "매우 높음: 차단 필수",
    // weather
    Clear_sky: "맑음",
    Partly_cloudy: "구름 조금",
    Cloudy: "흐림",
    Rain: "비",
    Snow: "눈",
    Rain_showers: "소나기",
    Snow_showers: "눈보라",
    Thunderstorm: "뇌우"
  },
  en: {
    today: "Today",
    tomorrow: "Tomorrow",
    searchPlaceholder: "Add location: e.g. Seoul, Tokyo",
    searchEmpty: "No results found.",
    locMax: "Maximum 2 locations allowed.",
    locAddSuccess: "Location added",
    locLoading: "Searching location...",
    locFail: "Location not found.",
    locLoadFail: "Failed to load locations",
    refreshing: "Refreshing weather...",
    reqLoc: "Please add a location.",
    recFail: "Failed to load recommendations.",
    upToDate: "Recommendations are up-to-date.",
    emptyCards: "Add a location to see recommendations.",
    precipProb: "Precipitation",
    tempRange: "Temp Range",
    low: "Low",
    high: "High",
    dataFallback: "Fallback",
    connFail: "Connection Failed",
    dataLive: "Live Data",
    noData: "N/A",
    dataFormatError: "Data format error",
    outfit: "Outfit",
    accessories: "Accessories",
    // metrics
    temp0: "Freezing: Prioritize warmth",
    temp8: "Very cold: Thick outer layer",
    temp15: "Cool: Layering recommended",
    temp24: "Comfortable: Basic wear",
    tempHot: "Hot: Breathability essential",
    hum40: "Dry: Moisturise",
    hum60: "Comfortable",
    hum75: "Humid: Manage sweat",
    humHumid: "Very humid: Breathability essential",
    uv3: "Low",
    uv5: "Moderate",
    uv8: "High: UV protection",
    uvVeryHigh: "Very high: Block sun",
    // weather
    Clear_sky: "Clear sky",
    Partly_cloudy: "Partly cloudy",
    Cloudy: "Cloudy",
    Rain: "Rain",
    Snow: "Snow",
    Rain_showers: "Rain showers",
    Snow_showers: "Snow showers",
    Thunderstorm: "Thunderstorm"
  }
};
const t = (key) => i18n[lang][key] || key;

document.documentElement.lang = lang;
if (lang === "en") {
  document.title = "Weather Outfit";
  const eyebrowEl = document.querySelector(".eyebrow");
  if (eyebrowEl) eyebrowEl.textContent = "What to wear today?";
  const titleEl = document.querySelector("h1");
  if (titleEl) titleEl.textContent = "Weather-based Outfit Recommendation";
  const subtitleEl = document.querySelector(".subtitle");
  if (subtitleEl) subtitleEl.textContent = "Considering temperature, humidity, UV, and precipitation.";
  const applyBtn = document.getElementById("apply-button");
  if (applyBtn) applyBtn.textContent = "Apply";
  const refreshBtn = document.getElementById("refresh-button");
  if (refreshBtn) refreshBtn.innerHTML = refreshBtn.innerHTML.replace("새로고침", "Refresh");
}

const state = {
  locations: [],
  cards: [],
  dateFilter: "today"
};

const locationsEl = document.getElementById("locations");
const statusEl = document.getElementById("status");
const formEl = document.getElementById("location-form");
const inputEl = document.getElementById("location-input");
const refreshEl = document.getElementById("refresh-button");
const autocompleteListEl = document.getElementById("autocomplete-list");
const cardsEl = document.getElementById("cards");
const applyButtonEl = document.getElementById("apply-button");
const toggleBtnEl = document.getElementById("date-toggle-btn");

formEl.addEventListener("submit", onAddLocation);
refreshEl.addEventListener("click", refreshRecommendations);

toggleBtnEl.addEventListener("click", () => {
  const newFilter = state.dateFilter === "today" ? "tomorrow" : "today";
  setDateFilter(newFilter);
});

let searchTimeout = null;

inputEl.addEventListener("input", (e) => {
  const val = e.target.value.trim();

  // 입력 여부에 따라 '적용' 버튼 활성화 상태 관리
  if (val.length > 0) {
    applyButtonEl.disabled = false;
  } else {
    applyButtonEl.disabled = true;
  }

  clearTimeout(searchTimeout);

  if (!val) {
    autocompleteListEl.hidden = true;
    return;
  }

  // 1초 디바운스
  searchTimeout = setTimeout(() => {
    fetchSuggestions(val);
  }, 1000);
});

// 외부 클릭 시 드롭다운 닫기
document.addEventListener("click", (e) => {
  if (!formEl.contains(e.target)) {
    autocompleteListEl.hidden = true;
  }
});

bootstrap();

async function bootstrap() {
  await loadLocations();
  await refreshRecommendations();
  setDateFilter(state.dateFilter); // Initialize tab state
}

async function loadLocations() {
  try {
    const saved = localStorage.getItem("weather_locations");
    if (saved) {
      state.locations = JSON.parse(saved);
    } else {
      // Default fallback if empty
      state.locations = [
        { id: "default-1", name: "Seoul", latitude: 37.5665, longitude: 126.978 }
      ];
      saveToLocal();
    }
    renderLocationTags();
  } catch (error) {
    updateStatus(t("locLoadFail"), "error");
  }
}

function setDateFilter(filter) {
  state.dateFilter = filter;
  if (filter === "today") {
    toggleBtnEl.textContent = t("today");
    toggleBtnEl.classList.remove("tomorrow");
  } else {
    toggleBtnEl.textContent = t("tomorrow");
    toggleBtnEl.classList.add("tomorrow");
  }
  renderCards();
}

function saveToLocal() {
  localStorage.setItem("weather_locations", JSON.stringify(state.locations));
}

async function fetchSuggestions(query) {
  try {
    const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
    endpoint.searchParams.set("name", query);
    endpoint.searchParams.set("count", "5");
    endpoint.searchParams.set("language", "en");

    const response = await fetch(endpoint);
    const data = await response.json();
    const results = data?.results || [];

    renderAutocomplete(results);
  } catch (error) {
    console.error("자동완성 조회 실패", error);
  }
}

function renderAutocomplete(results) {
  autocompleteListEl.innerHTML = "";
  if (results.length === 0) {
    autocompleteListEl.innerHTML = `<li class="empty-item">${t("searchEmpty")}</li>`;
  } else {
    results.forEach((item) => {
      const li = document.createElement("li");
      const sub = item.admin1 || item.country || "";
      li.textContent = `${item.name}${sub ? `, ${sub}` : ""}`;

      li.addEventListener("click", () => {
        addLocationFromSuggestion(item);
      });
      autocompleteListEl.appendChild(li);
    });
  }
  autocompleteListEl.hidden = false;
}

async function addLocationFromSuggestion(item) {
  autocompleteListEl.hidden = true;
  inputEl.value = "";
  applyButtonEl.disabled = true;

  if (state.locations.length >= 2) {
    updateStatus(t("locMax"), "error");
    return;
  }

  const next = {
    id: crypto.randomUUID(),
    name: item.name,
    latitude: item.latitude,
    longitude: item.longitude,
  };

  state.locations.push(next);
  saveToLocal();
  renderLocationTags();
  updateStatus(t("locAddSuccess"), "ok");
  await refreshRecommendations();
}

async function onAddLocation(event) {
  event.preventDefault();
  const query = inputEl.value.trim();
  if (!query) return;

  if (state.locations.length >= 2) {
    updateStatus(t("locMax"), "error");
    return;
  }

  try {
    updateStatus(t("locLoading"), "loading");
    const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
    endpoint.searchParams.set("name", query);
    endpoint.searchParams.set("count", "1");
    endpoint.searchParams.set("language", lang.split("-")[0]);

    const response = await fetch(endpoint);
    const data = await response.json();
    const first = data?.results?.[0];

    if (!first) {
      throw new Error(t("locFail"));
    }

    const next = {
      id: crypto.randomUUID(),
      name: first.name,
      latitude: first.latitude,
      longitude: first.longitude,
    };

    state.locations.push(next);
    saveToLocal();
    renderLocationTags();
    inputEl.value = "";
    applyButtonEl.disabled = true;
    updateStatus("위치 추가 완료", "ok");
    await refreshRecommendations();
  } catch (error) {
    updateStatus(error.message || "위치 추가 실패", "error");
  }
}

async function removeLocation(id) {
  state.locations = state.locations.filter(loc => loc.id !== id);
  saveToLocal();
  renderLocationTags();
  await refreshRecommendations();
}

function renderLocationTags() {
  const html = state.locations
    .map(
      (location) => `
      <button class="tag" data-id="${location.id}" type="button">
        ${location.name}
        <span class="tag-remove" aria-hidden="true">x</span>
      </button>
    `,
    )
    .join("");

  locationsEl.innerHTML = html || "";

  for (const button of locationsEl.querySelectorAll(".tag")) {
    button.addEventListener("click", () => removeLocation(button.dataset.id));
  }

  if (state.locations.length >= 2) {
    inputEl.placeholder = "";
  } else {
    inputEl.placeholder = t("searchPlaceholder");
  }
}

async function refreshRecommendations() {
  try {
    updateStatus(t("refreshing"), "loading");

    if (state.locations.length === 0) {
      state.cards = [];
      renderCards();
      updateStatus(t("reqLoc"), "ok");
      return;
    }

    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: state.locations, lang: lang }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || t("recFail"));
    }

    state.cards = data.cards;
    renderCards();
    updateStatus(t("upToDate"), "ok");
  } catch (error) {
    updateStatus(error.message || t("recFail"), "error");
  }
}

function renderCards() {
  const cardsEl = document.getElementById("cards");

  if (state.cards.length === 0) {
    cardsEl.innerHTML = `<p class="empty">${t("emptyCards")}</p>`;
    return;
  }

  cardsEl.classList.toggle("single-card", state.cards.length === 1);

  cardsEl.innerHTML = state.cards
    .map((entry) => {
      const isTomorrow = state.dateFilter === "tomorrow";
      const weather = isTomorrow && entry.weather.tomorrow ? entry.weather.tomorrow : entry.weather;
      const recommendation = isTomorrow && entry.tomorrowRecommendation ? entry.tomorrowRecommendation : entry.recommendation;

      const displayTemp = isTomorrow ? weather.tempMax : weather.tempC;
      const displayTempMax = weather.tempMax ?? entry.weather.tempMax;
      const displayTempMin = weather.tempMin ?? entry.weather.tempMin;
      const displayHumidity = weather.humidity ?? entry.weather.humidity ?? 0;

      const airQualityMessage = buildAirQualityLabel(weather.pm25, weather.pm10, weather.airQualityIndex);
      const rangeLabel = typeof weather.temperatureRange === "number" ? `${formatNum(weather.temperatureRange)}°C` : null;
      const tempMetric = getMetricByTemperature(displayTemp);
      const humidityMetric = getMetricByHumidity(displayHumidity);
      const uvMetric = getMetricByUv(weather.uvMax != null ? weather.uvMax : weather.uvIndex);

      const mainWeatherIcon = getWeatherIcon(weather.weatherDescription);

      return `
      <article class="card">
        <div class="card-header">
          <img src="assets/weather/${mainWeatherIcon}" alt="Weather Icon" class="main-weather-icon" />
          <div class="card-header-info">
            <h2>${entry.name}</h2>
            <div class="temp-display">${displayTemp != null ? formatNum(displayTemp) : "-"}°C</div>
            <div class="temp-range">${t('low')} ${displayTempMin != null ? formatNum(displayTempMin) : "-"}° / ${t('high')} ${displayTempMax != null ? formatNum(displayTempMax) : "-"}°</div>
            <div class="condition-label">${tempMetric.label}</div>
          </div>
        </div>
        <div class="metrics-row">
          <div class="metric-mini">
            <img src="assets/icons/humidity.svg" alt="Humidity" class="metric-mini-icon" />
            <div class="metric-mini-data">
              <span class="metric-mini-label">Humidity</span>
              <span class="metric-mini-value"><strong>${formatNum(displayHumidity)}%</strong> <span class="humidity-state">${humidityMetric.label.split(":")[0]}</span></span>
            </div>
          </div>
          <div class="metric-mini">
            <img src="assets/icons/uv.svg" alt="UV" class="metric-mini-icon" />
            <div class="metric-mini-data">
              <span class="metric-mini-label">UV: ${formatNum(weather.uvIndex)}</span>
              <span class="metric-mini-value"><span class="uv-state">${uvMetric.label.split(":")[0]}</span></span>
            </div>
          </div>
          <div class="metric-mini">
            <img src="assets/icons/pm25.svg" alt="PM2.5" class="metric-mini-icon" />
            <div class="metric-mini-data">
              <span class="metric-mini-label">PM2.5</span>
              <span class="metric-mini-value"><strong>${typeof weather.pm25 === "number" ? formatNum(weather.pm25) : "-"}</strong></span>
            </div>
          </div>
          <div class="metric-mini">
            <img src="assets/icons/pm10.svg" alt="PM10" class="metric-mini-icon" />
            <div class="metric-mini-data">
              <span class="metric-mini-label">PM10</span>
              <span class="metric-mini-value"><strong>${typeof weather.pm10 === "number" ? formatNum(weather.pm10) : "-"}</strong></span>
            </div>
          </div>
          <div class="metric-mini">
            <img src="assets/icons/aqi.svg" alt="AQI" class="metric-mini-icon" />
            <div class="metric-mini-data">
              <span class="metric-mini-label">US-AQI</span>
              <span class="metric-mini-value"><strong>${typeof weather.airQualityIndex === "number" ? formatNum(weather.airQualityIndex) : "-"}</strong></span>
            </div>
          </div>
        </div>
        <p class="metrics-sub">${t('precipProb')}: ${weather.precipitationProbability != null ? weather.precipitationProbability : t('noData')}%, ${t('tempRange')}: ${rangeLabel || t('noData')}</p>
        <p class="metrics-sub">Data: ${entry.weather.source === "fallback" ? `${t('dataFallback')} (${entry.weather.sourceMessage || t('connFail')})` : t('dataLive')} (${formatWeatherTimestamp(weather.updatedAt ?? entry.weather.updatedAt, entry.weather.timezone)})</p>
        <hr class="divider"/>
        <h3 class="section-title">${isTomorrow ? t("tomorrow") : t("today")} ${t("outfit")}</h3>
        <div class="recommendation">
          <img src="${recommendation.image}" alt="${recommendation.outfitLabel}" class="outfit-image" />
          <div class="outfit-details">
            <div class="outfit-main-items">
              ${recommendation.items.map((item, index) => {
        const hasNote = item.note && item.note.trim();
        return hasNote
          ? `<span class="outfit-item tooltip-container">${item.name}<span class="tooltip">${item.note}</span></span>${index < recommendation.items.length - 1 ? '<span class="comma">, </span>' : ''}`
          : `<span class="outfit-item">${item.name}</span>${index < recommendation.items.length - 1 ? '<span class="comma">, </span>' : ''}`;
      }).join("")}
            </div>
            ${recommendation.accessories.length > 0 ? `
            <div class="accessories-section">
              <p class="outfit-category">${t('accessories')}</p>
              <ul class="checklist">
                ${recommendation.accessories.map((acc) => acc.note
        ? `<li><span class="check-icon">✓</span> <span class="tooltip-container">${acc.name}<span class="tooltip">${acc.note}</span></span></li>`
        : `<li><span class="check-icon">✓</span> ${acc.name}</li>`
      ).join("")}
              </ul>
            </div>
            ` : ''}
          </div>
        </div>
      </article>
        `;
    })
    .join("");
}

function getWeatherIcon(description) {
  if (!description) return "sunny.png";
  const desc = description.toLowerCase();
  if (desc.includes("rain")) return "rainy.png";
  if (desc.includes("snow") || desc.includes("ice")) return "snowy.png";
  if (desc.includes("cloud") || desc.includes("overcast")) return "cloudy.png";
  return "sunny.png";
}

function getMetricByTemperature(tempC) {
  if (tempC <= 0) {
    return { image: "assets/weather/temp-cold.png", label: t("temp0") };
  }
  if (tempC <= 8) {
    return { image: "assets/weather/temp-cool.png", label: t("temp8") };
  }
  if (tempC <= 15) {
    return { image: "assets/weather/temp-mild.png", label: t("temp15") };
  }
  if (tempC <= 24) {
    return { image: "assets/weather/temp-warm.png", label: t("temp24") };
  }
  return { image: "assets/weather/temp-hot.png", label: t("tempHot") };
}

function getMetricByHumidity(humidity) {
  if (humidity <= 40) {
    return { image: "assets/weather/humidity-dry.png", label: t("hum40") };
  }
  if (humidity <= 60) {
    return { image: "assets/weather/humidity-comfort.png", label: t("hum60") };
  }
  if (humidity <= 75) {
    return { image: "assets/weather/humidity-high.png", label: t("hum75") };
  }
  return { image: "assets/weather/humidity-humid.png", label: t("humHumid") };
}

function getMetricByUv(uvIndex) {
  if (uvIndex <= 3) {
    return { image: "assets/weather/uv-low.png", label: t("uv3") };
  }
  if (uvIndex <= 5) {
    return { image: "assets/weather/uv-mid.png", label: t("uv5") };
  }
  if (uvIndex <= 8) {
    return { image: "assets/weather/uv-high.png", label: t("uv8") };
  }
  return { image: "assets/weather/uv-very-high.png", label: t("uvVeryHigh") };
}

function formatNum(value) {
  return Number.isInteger(value) ? value : value.toFixed(1);
}

function buildAirQualityLabel(pm25, pm10, airQualityIndex) {
  const values = [];
  if (typeof pm25 === "number") values.push(`PM2.5 ${formatNum(pm25)} `);
  if (typeof pm10 === "number") values.push(`PM10 ${formatNum(pm10)} `);
  if (typeof airQualityIndex === "number") values.push(`US - AQI ${formatNum(airQualityIndex)} `);

  return values.length ? values.join(" / ") : "데이터 미제공";
}

function formatWeatherTimestamp(timeString, timezone) {
  if (!timeString) return t("noData");

  const date = new Date(timeString);
  if (Number.isNaN(date.getTime())) return t("dataFormatError");

  return date.toLocaleString(lang === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

function updateStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type} `.trim();
}
