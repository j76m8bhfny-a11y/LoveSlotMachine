const app = getApp();
// 简单音效 (可选)
const audioCtx = wx.createInnerAudioContext();

// ⚠️ 填入你的心知天气私钥 (API Key)
const SENIVERSE_KEY = "SJJOIA7A76gQjzQjc"; 

Page({
  data: {
    relations: [
      { id: 0, label: '小心翼翼', sub: '初识', color: '#FFC0CB' },
      { id: 1, label: '小鹿乱撞', sub: '暧昧', color: '#FFB7B2' },
      { id: 2, label: '如胶似漆', sub: '热恋', color: '#FF6B6B' },
      { id: 3, label: '相爱相杀', sub: '磨合', color: '#E57373' },
      { id: 4, label: '老夫老妻', sub: '稳定', color: '#D32F2F' }
    ],
    selectedRelation: 2,
    
    times: [
      { name: '清晨', icon: '🌅', bg: 'bg-morning' },
      { name: '上午', icon: '☀️', bg: 'bg-am' },
      { name: '下午', icon: '☕', bg: 'bg-pm' },
      { name: '夜晚', icon: '🌙', bg: 'bg-night' }
    ],
    selectedTime: 2,
    pageBgClass: 'bg-pm',
    
    budget: 100,
    //sliderValue: 34,
    // coins: [], <--- 【删除】这里不需要了，交给组件管
    
    date: '2025-05-20',
    
    // 天气状态
    locationName: '📍 点击获取定位',
    weather: '未知', 
    temp: '25'     
  },

  onLoad() {
    const today = new Date().toISOString().substring(0, 10);
    this.setData({ 
      date: today,
      budget: 100 // 默认 100
    });
    // this.generateCoins(initialBudget); <--- 【删除】组件会自动监听 budget 变化并生成金币
    this.playBGM();
    this.getLocation();
  },

  playBGM() {},
  
  playClickSound() { 
    wx.vibrateShort({ type: 'light' }); 
  },
  
  selectRelation(e) { 
    this.setData({ selectedRelation: e.currentTarget.dataset.index }); 
    this.playClickSound(); 
  },
  
  selectTime(e) { 
    const idx = e.currentTarget.dataset.index;
    this.setData({ selectedTime: idx, pageBgClass: this.data.times[idx].bg }); 
    this.playClickSound(); 
  },
  
  onBudgetChange(e) {
    // 直接取值，不需要算法转换了
    const val = e.detail.value;
    this.setData({ budget: val });
  },
  
  // generateCoins(amount) { ... } <--- 【删除】整个函数都不需要了
  
  bindDateChange(e) { this.setData({ date: e.detail.value }); },

  // ==========================================
  // ✨✨ 地理位置与天气核心逻辑 (心知天气版) ✨✨
  // ==========================================

  getLocation() {
    // 自动定位建议静默进行，不弹 Loading 打断用户，除非失败
    wx.getLocation({
      type: 'wgs84',
      isHighAccuracy: true, // 开启高精度
      success: (res) => {
        console.log('自动定位成功', res);
        // 拿到经纬度后，立刻去查天气和城市名
        this.fetchWeather(res.longitude, res.latitude);
      },
      fail: (err) => {
        console.error('自动定位失败', err);
        // 失败了也不报错，保持默认状态，用户依然可以手动点击
        this.setData({ locationName: '📍 点击手动定位' });
      }
    });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({ 
          locationName: res.name || res.address || '已选位置' 
        });
        // 拿到经纬度查询天气
        this.fetchWeather(res.longitude, res.latitude);
      },
      fail: (err) => {
        // 用户取消选点
      }
    });
  },

  fetchWeather(lon, lat) {
    if (!SENIVERSE_KEY) return;

    wx.request({
      url: `https://api.seniverse.com/v3/weather/now.json?key=${SENIVERSE_KEY}&location=${lat}:${lon}&language=zh-Hans&unit=c`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data.results) {
          const result = res.data.results[0];
          const now = result.now;
          const loc = result.location; // ✨ 获取心知天气返回的城市信息

          this.setData({
            weather: now.text,        
            temp: now.temperature,
            // ✨✨ 核心修改：用天气接口里的城市名，自动填入位置栏 ✨✨
            // 例如：把 "📍 点击获取定位" 自动变成 "📍 北京"
            locationName: `📍 ${loc.name}` 
          });
        }
      },
      fail: (err) => {
        console.error('天气请求失败:', err);
      }
    });
  },

  submitConfig() {
    const queryData = {
      relation: this.data.relations[this.data.selectedRelation].label,
      time: this.data.times[this.data.selectedTime].name,
      budget: this.data.budget,
      location: this.data.locationName,
      date: this.data.date,
      weatherContext: `${this.data.weather}, ${this.data.temp}°C`
    };
    
    wx.navigateTo({
      url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(queryData))}`
    });
  }
});