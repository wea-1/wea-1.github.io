// script.js
class WeatherApp {
    constructor() {
        this.init();
    }

    async init() {
        try {
            const position = await this.getCurrentPosition();
            const weatherData = await this.getWeatherData(position.coords.latitude, position.coords.longitude);
            const locationName = await this.getLocationName(position.coords.latitude, position.coords.longitude);
            this.updateUI(weatherData, locationName);
        } catch (error) {
            console.error('Error:', error);
            this.showError('无法获取天气信息，请检查位置权限设置。');
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('您的浏览器不支持地理定位'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
    }

    async getWeatherData(latitude, longitude) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather data fetch failed');
        return await response.json();
    }

    async getLocationName(latitude, longitude) {
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Location name fetch failed');
        const data = await response.json();
        return `${data.city}, ${data.countryName}`;
    }

    updateUI(weatherData, locationName) {
        // 更新位置
        document.getElementById('location-text').textContent = locationName;

        // 更新当前天气
        const currentTemp = Math.round(weatherData.current_weather.temperature);
        document.getElementById('temperature').textContent = currentTemp;

        // 更新天气图标
        this.updateWeatherIcon(weatherData.current_weather.weathercode);

        // 更新天气描述
        document.getElementById('weather-description').textContent = 
            this.getWeatherDescription(weatherData.current_weather.weathercode);

        // 更新风速
        document.getElementById('wind-speed').textContent = 
            `${Math.round(weatherData.current_weather.windspeed)} km/h`;

        // 更新湿度（使用当前小时的湿度数据）
        const currentHour = new Date().getHours();
        document.getElementById('humidity').textContent = 
            `${Math.round(weatherData.hourly.relativehumidity_2m[currentHour])}%`;

        // 更新预报
        this.updateForecast(weatherData.daily);
    }

    updateWeatherIcon(weatherCode) {
        const iconElement = document.getElementById('weather-icon');
        // 根据天气代码设置适当的图标
        const iconClass = this.getWeatherIconClass(weatherCode);
        iconElement.className = `fas ${iconClass}`;
    }

    getWeatherIconClass(weatherCode) {
        // 根据Open-Meteo的天气代码返回适当的Font Awesome图标类
        const weatherIcons = {
            0: 'fa-sun', // 晴天
            1: 'fa-cloud-sun', // 多云
            2: 'fa-cloud', // 阴天
            3: 'fa-cloud', // 阴天
            45: 'fa-smog', // 雾
            48: 'fa-smog', // 霾
            51: 'fa-cloud-rain', // 小雨
            53: 'fa-cloud-rain', // 中雨
            55: 'fa-cloud-showers-heavy', // 大雨
            61: 'fa-cloud-rain', // 小雨
            63: 'fa-cloud-rain', // 中雨
            65: 'fa-cloud-showers-heavy', // 大雨
            71: 'fa-snowflake', // 小雪
            73: 'fa-snowflake', // 中雪
            75: 'fa-snowflake', // 大雪
            95: 'fa-bolt', // 雷暴
        };
        return weatherIcons[weatherCode] || 'fa-cloud';
    }

    getWeatherDescription(weatherCode) {
        const descriptions = {
            0: '晴天',
            1: '多云',
            2: '阴天',
            3: '阴天',
            45: '有雾',
            48: '霾',
            51: '小雨',
            53: '中雨',
            55: '大雨',
            61: '小雨',
            63: '中雨',
            65: '大雨',
            71: '小雪',
            73: '中雪',
            75: '大雪',
            95: '雷暴',
        };
        return descriptions[weatherCode] || '未知天气';
    }

    updateForecast(dailyData) {
        const forecastContainer = document.getElementById('forecast');
        forecastContainer.innerHTML = '';

        // 获取未来5天的预报
        const days = ['今天', '明天', '后天', '第4天', '第5天'];
        
        for (let i = 0; i < 5; i++) {
            const maxTemp = Math.round(dailyData.temperature_2m_max[i]);
            const minTemp = Math.round(dailyData.temperature_2m_min[i]);
            
            const forecastItem = document.createElement('div');
            forecastItem.className = 'forecast-item';
            forecastItem.innerHTML = `
                <div class="day">${days[i]}</div>
                <div class="temp">${maxTemp}° / ${minTemp}°</div>
            `;
            
            forecastContainer.appendChild(forecastItem);
        }
    }

    showError(message) {
        document.getElementById('weather-description').textContent = message;
        document.getElementById('location-text').textContent = '位置未知';
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});