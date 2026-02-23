
async function checkExactUrl() {
    const latitude = 37.5665;
    const longitude = 126.978;
    const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
    endpoint.searchParams.set("latitude", String(latitude));
    endpoint.searchParams.set("longitude", String(longitude));
    // Removed "time" from current parameters as it is invalid
    endpoint.searchParams.set(
        "current",
        "temperature_2m,relative_humidity_2m,uv_index,precipitation",
    );
    endpoint.searchParams.set(
        "daily",
        "precipitation_probability_max,temperature_2m_max,temperature_2m_min",
    );
    endpoint.searchParams.set("hourly", "temperature_2m");
    endpoint.searchParams.set("forecast_days", "1");
    endpoint.searchParams.set("timezone", "auto");

    const url = endpoint.toString();
    console.log(`Fetching ${url} ...`);

    try {
        const res = await fetch(endpoint);
        console.log("Status:", res.status);
        console.log("StatusText:", res.statusText);
        const text = await res.text();
        if (!res.ok) {
            console.log("Error Body:", text.substring(0, 500));
        } else {
            console.log("Success! json length:", text.length);
        }
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

checkExactUrl();
