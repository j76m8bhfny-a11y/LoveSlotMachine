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
    sliderValue: 34,
    coins: [], 
    date: '2025-05-20',
    
    // 天气状态
    locationName: '📍 点击获取定位',
    weather: '未知', 
    temp: '25'     
  },

  onLoad() {
    const today = new Date().toISOString().substring(0, 10);
    const initialBudget = 100;
    
    this.setData({ 
      date: today,
      budget: initialBudget,
      sliderValue: this.budgetToSlider(initialBudget)
    });
    this.generateCoins(initialBudget); 
    this.playBGM();
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
  
  // --- 预算滑块逻辑 ---
  sliderToBudget(val) {
    if (val > 100) val = (val / 5000) * 100;
    let budget = 0;
    if (val <= 10) budget = val * 5; 
    else if (val <= 50) budget = 50 + (val - 10) * 6.25; 
    else if (val <= 80) budget = 300 + (val - 50) * 23.33; 
    else budget = 1000 + (val - 80) * 200; 
    return Math.floor(budget / 10) * 10; 
  },
  
  budgetToSlider(budget) {
     if (budget <= 50) return budget / 5;
     if (budget <= 300) return 10 + (budget - 50) / 6.25;
     if (budget <= 1000) return 50 + (budget - 300) / 23.33;
     return 80 + (budget - 1000) / 200;
  },
  
  onBudgetChange(e) {
    const sliderVal = e.detail.value;
    const realBudget = this.sliderToBudget(sliderVal);
    if (realBudget !== this.data.budget) {
      this.setData({ sliderValue: sliderVal, budget: realBudget });
      this.generateCoins(realBudget);
      wx.vibrateShort({ type: 'light' }); 
    }
  },
  
  generateCoins(amount) {
    let count = 0;
    if (amount < 200) count = Math.floor(amount / 20); 
    else if (amount < 1000) count = 10 + Math.floor((amount - 200) / 80); 
    else count = 20 + Math.floor((amount - 1000) / 200); 
    count = Math.min(count, 40);
    let newCoins = [];
    for (let i = 0; i < count; i++) {
      newCoins.push({
        id: i,
        type: Math.random() > 0.8 ? '💵' : '💰', 
        left: Math.floor(Math.random() * 90), 
        rotate: Math.floor(Math.random() * 60 - 30), 
        animDelay: Math.random() * 0.5 
      });
    }
    this.setData({ coins: newCoins });
  },
  
  bindDateChange(e) { this.setData({ date: e.detail.value }); },

  // ==========================================
  // ✨✨ 地理位置与天气核心逻辑 (心知天气版) ✨✨
  // ==========================================

  getLocation() {
    wx.showLoading({ title: '定位中...' });
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        this.setData({ locationName: '📍 当前位置' });
        this.fetchWeather(res.longitude, res.latitude);
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '定位失败，请检查授权', icon: 'none' });
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
    if (!SENIVERSE_KEY) {
      wx.hideLoading();
      return;
    }

    console.log(`正在请求心知天气: ${lat}:${lon}`);

    wx.request({
      // ✨ 心知天气 V3 接口
      // 注意 location 参数格式为: 纬度:经度 (lat:lon)
      url: `https://api.seniverse.com/v3/weather/now.json?key=${SENIVERSE_KEY}&location=${lat}:${lon}&language=zh-Hans&unit=c`,
      
      method: 'GET',
      
      success: (res) => {
        console.log('心知天气返回:', res);

        if (res.statusCode === 200 && res.data.results) {
          const now = res.data.results[0].now;
          this.setData({
            weather: now.text,        // 天气现象文字，例如“晴”
            temp: now.temperature     // 温度
          });
          wx.showToast({ title: `当地: ${now.text} ${now.temperature}°C`, icon: 'none' });
        } else {
          console.error('天气API异常:', res.data);
          // 容错处理
          this.setData({ weather: '未知', temp: '25' }); 
        }
      },
      fail: (err) => {
        console.error('网络请求失败:', err);
      },
      complete: () => wx.hideLoading()
    });
  },

  submitConfig() {
    const queryData = {
      relation: this.data.relations[this.data.selectedRelation].label,
      time: this.data.times[this.data.selectedTime].name,
      budget: this.data.budget,
      location: this.data.locationName,
      date: this.data.date,
      // 传递天气信息
      weatherContext: `${this.data.weather}, ${this.data.temp}°C`
    };
    
    wx.navigateTo({
      url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(queryData))}`
    });
  }
});