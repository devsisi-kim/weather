const state = {
  locations: [],
  cards: [],
};

const locationsEl = document.getElementById("locations");
const statusEl = document.getElementById("status");
const formEl = document.getElementById("location-form");
const inputEl = document.getElementById("location-input");
const refreshEl = document.getElementById("refresh-button");

formEl.addEventListener("submit", onAddLocation);
refreshEl.addEventListener("click", refreshRecommendations);

bootstrap();

async function bootstrap() {
  await loadLocations();
  await refreshRecommendations();
}

async function loadLocations() {
  try {
    const response = await fetch("/api/locations");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "위치 목록 조회에 실패했습니다.");
    }

    state.locations = data.locations;
    renderLocationTags();
  } catch (error) {
    updateStatus(error.message || "위치 목록 조회 실패", "error");
  }
}

async function onAddLocation(event) {
  event.preventDefault();
  const query = inputEl.value.trim();
  if (!query) return;

  try {
    updateStatus("위치 추가 중...", "loading");
    const response = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "위치 추가에 실패했습니다.");
    }

    state.locations = data.locations;
    renderLocationTags();
    inputEl.value = "";
    updateStatus("위치 추가 완료", "ok");
    await refreshRecommendations();
  } catch (error) {
    updateStatus(error.message || "위치 추가 실패", "error");
  }
}

async function removeLocation(id) {
  try {
    const response = await fetch(`/api/locations/${id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "위치 삭제에 실패했습니다.");
    }

    state.locations = data.locations;
    renderLocationTags();
    await refreshRecommendations();
  } catch (error) {
    updateStatus(error.message || "위치 삭제 실패", "error");
  }
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

  locationsEl.innerHTML = html || "<p class=\"empty\">저장된 위치가 없습니다.</p>";

  for (const button of locationsEl.querySelectorAll(".tag")) {
    button.addEventListener("click", () => removeLocation(button.dataset.id));
  }
}

async function refreshRecommendations() {
  try {
    updateStatus("날씨 및 추천 갱신 중...", "loading");
    const response = await fetch("/api/recommendations");
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

  cardsEl.innerHTML = state.cards
    .map((entry) => {
      const { weather, recommendation } = entry;
      const airQualityMessage = buildAirQualityLabel(weather.pm25, weather.pm10, weather.airQualityIndex);
      const rangeLabel = typeof weather.temperatureRange === "number" ? `${formatNum(weather.temperatureRange)}°C` : null;
      const tempMetric = getMetricByTemperature(weather.tempC);
      const humidityMetric = getMetricByHumidity(weather.humidity);
      const uvMetric = getMetricByUv(weather.uvIndex);

      return `
      <article class="card">
        <h2>${entry.name}</h2>
        <div class="metrics-grid">
          <div class="metric-item">
            <img src="${tempMetric.image}" alt="Temperature" class="metric-icon-img" />
            <span class="metric-text"><strong>기온 ${formatNum(weather.tempC)}°C</strong><span>${tempMetric.label}</span></span>
          </div>
          <div class="metric-item">
            <img src="${humidityMetric.image}" alt="Humidity" class="metric-icon-img" />
            <span class="metric-text"><strong>습도 ${weather.humidity}%</strong><span>${humidityMetric.label}</span></span>
          </div>
          <div class="metric-item">
            <img src="${uvMetric.image}" alt="UV Index" class="metric-icon-img" />
            <span class="metric-text"><strong>UV ${formatNum(weather.uvIndex)}</strong><span>${uvMetric.label}</span></span>
          </div>
        </div>
        <p class="metrics">강수확률 ${weather.precipitationProbability}%</p>
        <p class="metrics">일교차 ${rangeLabel || "미확인"}</p>
        <p class="metrics">대기질 ${airQualityMessage}</p>
        <p class="metrics">데이터 소스: ${weather.source === "fallback" ? `임시 데이터 (${weather.sourceMessage || "연결 실패"})` : "실시간 API"}</p>
        <p class="metrics">갱신 시각: ${formatWeatherTimestamp(weather.updatedAt, weather.timezone)}</p>
        <div class="recommendation">
          <img src="${recommendation.image}" alt="${recommendation.outfitLabel}" class="outfit-image" />
          <div>
            <p class="outfit-title">${recommendation.outfitLabel}</p>
            <p class="outfit-items">${recommendation.items.join(", ")}</p>
          </div>
        </div>
        <p class="accessories"><strong>소품:</strong> ${recommendation.accessories.length ? recommendation.accessories.join(", ") : "선택 없음"}</p>
        <ul class="notes">
          ${recommendation.notes.map((note) => `<li>${note}</li>`).join("") || "<li>현재 조건에서 기본 복장을 권장합니다.</li>"}
        </ul>
      </article>
      `;
    })
    .join("");
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
  if (typeof pm25 === "number") values.push(`PM2.5 ${formatNum(pm25)}`);
  if (typeof pm10 === "number") values.push(`PM10 ${formatNum(pm10)}`);
  if (typeof airQualityIndex === "number") values.push(`US-AQI ${formatNum(airQualityIndex)}`);

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
  statusEl.className = `status ${type}`.trim();
}
