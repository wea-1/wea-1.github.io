// script.js
class WeatherApp {
    constructor() {
        // 用户信息和时间
        this.userInfo = {
            login: 'user',
            lastLogin: '1980-01-01 00:00:00'
        };
        
        // 定义API配置
        this.apis = {
            // 主要API - 无需密钥
            openMeteo: {
                name: 'Open-Meteo',
                baseUrl: 'https://api.open-meteo.com/v1/forecast',
                isActive: true,
                fetchOptions: {
                    params: {
                        hourly: 'temperature_2m,relativehumidity_2m,windspeed_10m,precipitation_probability',
                        daily: 'temperature_2m_max,temperature_2m_min,weathercode',
                        current_weather: true,
                        timezone: 'auto'
                    }
                }
            }
        };

        // 初始化缓存系统
        this.cache = {
            weather: null,
            location: null,
            lastUpdate: null,
            expiryTime: 10 * 60 * 1000 // 10分钟缓存
        };

        // 初始化状态
        this.state = {
            loading: false,
            error: null,
            lastRefresh: null
        };

        // 初始化应用
        this.init();
    }

    async init() {
        try {
            this.showLoading();
            await this.setupApp();
            await this.loadWeatherData();
        } catch (error) {
            console.error('初始化错误:', error);
            this.showError('初始化失败，请刷新页面重试');
        } finally {
            this.hideLoading();
        }
    }

    async setupApp() {
        this.setupEventListeners();
        this.startTimeUpdate();
        this.setupTheme();
    }

    setupEventListeners() {
        // 刷新按钮
        const refreshBtn = document.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshWeather());
        }

        // 监听在线状态
        window.addEventListener('online', () => {
            this.showNotification('网络已连接，正在更新天气...', 'success');
            this.refreshWeather();
        });

        window.addEventListener('offline', () => {
            this.showNotification('网络已断开，使用缓存数据...', 'warning');
        });

        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.shouldRefresh()) {
                this.refreshWeather();
            }
        });
    }

    startTimeUpdate() {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            
            const timeElement = document.querySelector('#date-time span');
            if (timeElement) {
                timeElement.textContent = timeString;
            }
        };

        updateTime();
        setInterval(updateTime, 1000);
    }

    setupTheme() {
        const hours = new Date().getHours();
        const isDarkMode = hours >= 18 || hours < 6;
        document.body.classList.toggle('dark-mode', isDarkMode);
    }

    async loadWeatherData() {
        if (this.cache.weather && !this.shouldRefresh()) {
            this.updateUI(this.cache.weather, this.cache.location);
            return;
        }

        try {
            const position = await this.getCurrentPosition();
            await this.updateWeather(position);
        } catch (error) {
            await this.fallbackToIPLocation();
        }
    }

    shouldRefresh() {
        return !this.cache.lastUpdate || 
               (Date.now() - this.cache.lastUpdate) > this.cache.expiryTime;
    }

    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('您的浏览器不支持地理定位'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });
    }

    async fallbackToIPLocation() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) throw new Error('IP定位服务异常');
            
            const data = await response.json();
            return {
                coords: {
                    latitude: data.latitude,
                    longitude: data.longitude
                }
            };
        } catch (error) {
            throw new Error('无法获取位置信息');
        }
    }

    async updateWeather(position) {
        const { latitude, longitude } = position.coords;

        try {
            const weatherData = await this.fetchWeatherData(latitude, longitude);
            const locationName = await this.getLocationName(latitude, longitude);

            this.cache.weather = weatherData;
            this.cache.location = locationName;
            this.cache.lastUpdate = Date.now();

            this.updateUI(weatherData, locationName);
        } catch (error) {
            this.showError('获取天气数据失败');
            throw error;
        }
    }

    async fetchWeatherData(latitude, longitude) {
        const api = this.apis.openMeteo;
        const url = new URL(api.baseUrl);
        
        // 添加基础参数
        url.searchParams.append('latitude', latitude);
        url.searchParams.append('longitude', longitude);
        
        // 添加其他参数
        Object.entries(api.fetchOptions.params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });

        const response = await fetch(url);
        if (!response.ok) throw new Error('天气数据获取失败');
        
        return await response.json();
    }

    async getLocationName(latitude, longitude) {
        try {
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`
            );
            
            if (!response.ok) throw new Error('地理编码失败');
            
            const data = await response.json();
            return [
                data.city,
                data.locality,
                data.countryName
            ].filter(Boolean).join(', ');
        } catch (error) {
            return '未知位置';
        }
    }

    updateUI(weatherData, locationName) {
        // 更新位置信息
        document.getElementById('location-text').textContent = locationName;

        // 更新当前天气
        const current = weatherData.current_weather;
        document.getElementById('temperature').textContent = Math.round(current.temperature);
        document.getElementById('weather-description').textContent = 
            this.getWeatherDescription(current.weathercode);

        // 更新天气图标
        this.updateWeatherIcon(current.weathercode);

        // 更新详细信息
        const currentHour = new Date().getHours();
        const hourlyData = weatherData.hourly;
        
        document.getElementById('wind-speed').textContent = 
            `${Math.round(current.windspeed)} km/h`;
        document.getElementById('humidity').textContent = 
            `${hourlyData.relativehumidity_2m[currentHour]}%`;

        // 更新预报
        this.updateDailyForecast(weatherData.daily);
        this.updateHourlyForecast(weatherData.hourly);

        // 更新最后更新时间
        this.updateLastUpdateTime();
    }

    updateWeatherIcon(weatherCode) {
        const iconElement = document.getElementById('weather-icon');
        iconElement.className = `fas ${this.getWeatherIconClass(weatherCode)}`;
    }

    getWeatherIconClass(weatherCode) {
        const icons = {
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
        return icons[weatherCode] || 'fa-cloud';
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

    updateDailyForecast(dailyData) {
        const container = document.getElementById('forecast');
        if (!container) return;

        container.innerHTML = '';
        const days = ['今天', '明天', '后天', '第4天', '第5天', '第6天', '第7天'];

        for (let i = 0; i < 7 && i < dailyData.temperature_2m_max.length; i++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'forecast-item';
            dayElement.innerHTML = `
                <div class="day">${days[i]}</div>
                <div class="forecast-icon">
                    <i class="${this.getWeatherIconClass(dailyData.weathercode[i])}"></i>
                </div>
                <div class="forecast-temp">
                    <span class="high">${Math.round(dailyData.temperature_2m_max[i])}°</span>
                    <span class="low">${Math.round(dailyData.temperature_2m_min[i])}°</span>
                </div>
            `;
            container.appendChild(dayElement);
        }
    }

    updateHourlyForecast(hourlyData) {
        const container = document.getElementById('hourly-forecast');
        if (!container) return;

        container.innerHTML = '';
        const currentHour = new Date().getHours();

        for (let i = 0; i < 24; i++) {
            const hour = (currentHour + i) % 24;
            const hourElement = document.createElement('div');
            hourElement.className = 'hourly-item';
            hourElement.innerHTML = `
                <div class="hour">${hour}:00</div>
                <div class="temp">${Math.round(hourlyData.temperature_2m[hour])}°</div>
                <div class="precipitation">
                    ${hourlyData.precipitation_probability[hour]}%
                </div>
            `;
            container.appendChild(hourElement);
        }
    }

    updateLastUpdateTime() {
        const lastUpdateElement = document.getElementById('last-update');
        if (lastUpdateElement) {
            const now = new Date();
            lastUpdateElement.textContent = `最后更新: ${now.toLocaleTimeString('zh-CN')}`;
        }
    }

    async refreshWeather() {
        if (this.state.loading) return;

        try {
            this.showLoading();
            const position = await this.getCurrentPosition();
            await this.updateWeather(position);
            this.showNotification('天气数据已更新', 'success');
        } catch (error) {
            this.showError('刷新天气数据失败');
            console.error('刷新错误:', error);
        } finally {
            this.hideLoading();
        }
    }

    showLoading() {
        this.state.loading = true;
        const refreshIcon = document.querySelector('.refresh-btn i');
        if (refreshIcon) {
            refreshIcon.classList.add('fa-spin');
        }
    }

    hideLoading() {
        this.state.loading = false;
        const refreshIcon = document.querySelector('.refresh-btn i');
        if (refreshIcon) {
            refreshIcon.classList.remove('fa-spin');
        }
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        document.body.appendChild(errorElement);

        setTimeout(() => {
            errorElement.remove();
        }, 3000);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
}

// 创建应用实例
const weatherApp = new WeatherApp();

// 错误处理
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('全局错误:', msg);
    weatherApp.showError('发生错误，请刷新页面重试');
    return false;
};