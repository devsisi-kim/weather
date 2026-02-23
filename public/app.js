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
const tabTodayEl = document.getElementById("date-tab-today");
const tabTomorrowEl = document.getElementById("date-tab-tomorrow");

formEl.addEventListener("submit", onAddLocation);
refreshEl.addEventListener("click", refreshRecommendations);

tabTodayEl.addEventListener("click", () => setDateFilter("today"));
tabTomorrowEl.addEventListener("click", () => setDateFilter("tomorrow"));

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
    updateStatus("로컬 위치 목록 조회 실패", "error");
  }
}

function setDateFilter(filter) {
  state.dateFilter = filter;
  if (filter === "today") {
    tabTodayEl.classList.add("active");
    tabTomorrowEl.classList.remove("active");
  } else {
    tabTomorrowEl.classList.add("active");
    tabTodayEl.classList.remove("active");
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
    autocompleteListEl.innerHTML = `<li class="empty-item">검색 결과가 없습니다.</li>`;
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
    updateStatus("위치는 최대 2개까지만 저장할 수 있습니다.", "error");
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
  updateStatus("위치 추가 완료", "ok");
  await refreshRecommendations();
}

async function onAddLocation(event) {
  event.preventDefault();
  const query = inputEl.value.trim();
  if (!query) return;

  if (state.locations.length >= 2) {
    updateStatus("위치는 최대 2개까지만 저장할 수 있습니다.", "error");
    return;
  }

  try {
    updateStatus("위치 검색 중...", "loading");
    const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
    endpoint.searchParams.set("name", query);
    endpoint.searchParams.set("count", "1");
    endpoint.searchParams.set("language", "en");

    const response = await fetch(endpoint);
    const data = await response.json();
    const first = data?.results?.[0];

    if (!first) {
      throw new Error("위치를 찾지 못했습니다.");
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
}

async function refreshRecommendations() {
  try {
    updateStatus("날씨 및 추천 갱신 중...", "loading");

    if (state.locations.length === 0) {
      state.cards = [];
      renderCards();
      updateStatus("위치를 추가해주세요.", "ok");
      return;
    }

    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: state.locations }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "추천 조회에 실패했습니다.");
    }

    state.cards = data.cards;
    renderCards();
    updateStatus("추천이 최신 상태입니다.", "ok");
  } catch (error) {
    updateStatus(error.message || "추천 조회 실패", "error");
  }
}

function renderCards() {
  const cardsEl = document.getElementById("cards");

  if (state.cards.length === 0) {
    cardsEl.innerHTML = "<p class=\"empty\">위치를 추가하면 추천이 표시됩니다.</p>";
    return;
  }

  cardsEl.classList.toggle("single-card", state.cards.length === 1);

  cardsEl.innerHTML = state.cards
    .map((entry) => {
      const isTomorrow = state.dateFilter === "tomorrow";
      const weather = isTomorrow && entry.weather.tomorrow ? entry.weather.tomorrow : entry.weather;
      const recommendation = isTomorrow && entry.tomorrowRecommendation ? entry.tomorrowRecommendation : entry.recommendation;

      const displayTemp = isTomorrow ? weather.tempAvg : weather.tempC;
      const displayHumidity = weather.humidity ?? entry.weather.humidity ?? 0;

      const airQualityMessage = buildAirQualityLabel(weather.pm25, weather.pm10, weather.airQualityIndex);
      const rangeLabel = typeof weather.temperatureRange === "number" ? `${formatNum(weather.temperatureRange)}°C` : null;
      const tempMetric = getMetricByTemperature(displayTemp);
      const humidityMetric = getMetricByHumidity(displayHumidity);
      const uvMetric = getMetricByUv(weather.uvIndex);

      const mainWeatherIcon = getWeatherIcon(weather.weatherDescription);

      return `
      <article class="card">
        <div class="card-header">
          <img src="assets/weather/${mainWeatherIcon}" alt="Weather Icon" class="main-weather-icon" />
          <div class="card-header-info">
            <h2>${entry.name}</h2>
            <div class="temp-display">${displayTemp != null ? formatNum(displayTemp) : "-"}°C</div>
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
        <p class="metrics-sub">강수확률: ${weather.precipitationProbability != null ? weather.precipitationProbability : "미확인"}%, 일교차: ${rangeLabel || "미확인"}</p>
        <p class="metrics-sub">데이터: ${weather.source === "fallback" ? `임시 (${weather.sourceMessage || "연결 실패"})` : "실시간 기준"} (${formatWeatherTimestamp(weather.updatedAt, weather.timezone)})</p>
        <hr class="divider"/>
        <h3 class="section-title">${isTomorrow ? "Tomorrow's" : "Today's"} Outfit</h3>
        <div class="recommendation">
          <img src="${recommendation.image}" alt="${recommendation.outfitLabel}" class="outfit-image" />
          <div class="outfit-details">
            <div class="outfit-main-items">
              ${recommendation.items.map((item, index) => `<span class="outfit-item">${item.name}</span>${index < recommendation.items.length - 1 ? '<span class="comma">, </span>' : ''}`).join("")}
            </div>
            ${recommendation.accessories.length > 0 ? `
            <div class="accessories-section">
              <p class="outfit-category">Accessories</p>
              <ul class="checklist">
                ${recommendation.accessories.map((acc) => `<li><span class="check-icon">✓</span> ${acc.name}</li>`).join("")}
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
    return { image: "assets/weather/temp-cold.png", label: "영하권: 보온이 우선입니다" };
  }
  if (tempC <= 8) {
    return { image: "assets/weather/temp-cool.png", label: "매우 쌀쌀: 겉옷 강화" };
  }
  if (tempC <= 15) {
    return { image: "assets/weather/temp-mild.png", label: "서늘: 레이어링 권장" };
  }
  if (tempC <= 24) {
    return { image: "assets/weather/temp-warm.png", label: "쾌적: 기본 복장" };
  }
  return { image: "assets/weather/temp-hot.png", label: "더움: 통기성 필수" };
}

function getMetricByHumidity(humidity) {
  if (humidity <= 40) {
    return { image: "assets/weather/humidity-dry.png", label: "건조: 보습 필요" };
  }
  if (humidity <= 60) {
    return { image: "assets/weather/humidity-comfort.png", label: "적당: 쾌적한 구간" };
  }
  if (humidity <= 75) {
    return { image: "assets/weather/humidity-high.png", label: "습함: 땀 관리 필요" };
  }
  return { image: "assets/weather/humidity-humid.png", label: "높은 습도: 통기성 중요" };
}

function getMetricByUv(uvIndex) {
  if (uvIndex <= 3) {
    return { image: "assets/weather/uv-low.png", label: "낮음" };
  }
  if (uvIndex <= 5) {
    return { image: "assets/weather/uv-mid.png", label: "보통" };
  }
  if (uvIndex <= 8) {
    return { image: "assets/weather/uv-high.png", label: "높음: 자외선 대비" };
  }
  return { image: "assets/weather/uv-very-high.png", label: "매우 높음: 차단 필수" };
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
  if (!timeString) return "데이터 미제공";

  const date = new Date(timeString);
  if (Number.isNaN(date.getTime())) return "데이터 형식 오류";

  return date.toLocaleString("ko-KR", {
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
