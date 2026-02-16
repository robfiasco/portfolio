function getWeatherContent() {
    if (!lastWeatherData) {
        return `
                    <div class="content-section">
                        <p style="opacity: 0.7;">Acquiring weather signal...</p>
                    </div>
                `;
    }

    const iconHtml = renderWeatherIcon(lastWeatherData.type);
    const condition = lastWeatherData.condition || 'Unknown';
    const temp = lastWeatherData.temp ?? '--';

    const forecastItems = (lastWeatherData.forecast || []).map(f => {
        const codeType = weatherCodeToType(f.code);
        let miniIcon = renderWeatherIcon(codeType).replace('class="weather-icon', 'class="forecast-icon');

        return `
                <div class="forecast-item">
                    <span class="forecast-time">${f.hour}:00</span>
                    ${miniIcon}
                    <span class="forecast-temp">${f.temp}°</span>
                </div>
            `}).join('');

    return `
                <div class="weather-card">
                    <div class="weather-main">
                        <div class="weather-main-icon">${iconHtml}</div>
                        <div class="weather-main-temp">${temp}°</div>
                        <div class="weather-main-condition">${condition}</div>
                    </div>
                
                    <div class="weather-forecast">
                        ${forecastItems || '<div style="font-size:12px;opacity:0.7;width:100%;text-align:center">Forecast unavailable</div>'}
                    </div>

                    <p style="font-size: 11px; opacity: 0.5; margin-top: 10px;">Jamestown, NY • Updated ${formatUpdatedAgo(lastWeatherData.timestamp)}</p>
                </div>
            `;
}
