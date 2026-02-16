// Fetch current weather from Open-Meteo and cache for 15 minutes.
async function updateWeather() {
    const textEl = document.getElementById('wxText');
    const iconEl = document.getElementById('wxIcon');
    if (!textEl || !iconEl) return;
    const cacheKey = 'weather_cache';
    const cacheRaw = localStorage.getItem(cacheKey);
    const now = Date.now();
    if (cacheRaw) {
        try {
            const cached = JSON.parse(cacheRaw);
            if (cached && cached.timestamp && now - cached.timestamp < 15 * 60 * 1000) {
                lastWeatherData = cached;
                if (cached.temp !== null && cached.temp !== undefined) {
                    textEl.textContent = `Jamestown ${cached.temp}° · ${cached.condition || '—'}`;
                } else {
                    textEl.textContent = 'Jamestown —';
                }
                iconEl.innerHTML = renderWeatherIcon(cached.type || 'cloudy');
                iconEl.title = `Jamestown: ${cached.temp ?? '—'}°${cached.condition ? ` • ${cached.condition}` : ''} (updated ${formatUpdatedAgo(cached.timestamp)})`;
                return;
            }
        } catch (e) {

        }
    }

    try {
        const lat = 42.0970;
        const lon = -79.2353;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&hourly=temperature_2m,weathercode&temperature_unit=fahrenheit`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather fetch failed');
        const data = await response.json();
        const current = data.current || {};
        const temp = typeof current.temperature_2m === 'number' ? Math.round(current.temperature_2m) : null;
        const condition = weatherCodeToLabel(current.weathercode);
        const type = weatherCodeToType(current.weathercode);

        // Determine theme based on type and time of day
        let theme = type;
        const hour = new Date().getHours();
        const isNight = hour >= 20 || hour < 6; // 8PM - 6AM

        if (isNight && (type === 'sunny' || type === 'partly' || type === 'cloudy')) {
            theme = 'night';
        }

        const text = temp !== null ? `Jamestown ${temp}° · ${condition}` : 'Jamestown —';

        const hourly = data.hourly || {};
        const forecast = [];
        if (Array.isArray(hourly.time) && Array.isArray(hourly.temperature_2m)) {
            const nowIndex = hourly.time.findIndex((t) => new Date(t).getTime() >= now);
            for (let i = 0; i < 3; i++) {
                const idx = Math.max(0, nowIndex) + i + 1; // Start from next hour
                // Ensure we don't go out of bounds
                if (hourly.time[idx]) {
                    const hDate = new Date(hourly.time[idx]);
                    const hourStr = hDate.getHours().toString().padStart(2, '0');
                    const t = Math.round(hourly.temperature_2m[idx]);
                    const code = hourly.weathercode ? hourly.weathercode[idx] : null;
                    forecast.push({ hour: hourStr, temp: t, code: code });
                }
            }
        }

        lastWeatherData = {
            text,
            temp,
            condition,
            type,
            theme,
            timestamp: now,
            forecast
        };

        textEl.textContent = text;
        iconEl.innerHTML = renderWeatherIcon(type);
        iconEl.title = `Jamestown: ${temp ?? '—'}°${condition ? ` • ${condition}` : ''} (updated ${formatUpdatedAgo(now)})`;
        localStorage.setItem(cacheKey, JSON.stringify(lastWeatherData));
    } catch (e) {
        lastWeatherData = null;
        textEl.textContent = 'Jamestown —';
        iconEl.innerHTML = renderWeatherIcon('neutral');
        iconEl.title = 'Weather unavailable';
        console.error(e);
    }
}
