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
    // coins: [], <--- 【删除】这里不需要了，交给组件管
    
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
    // this.generateCoins(initialBudget); <--- 【删除】组件会自动监听 budget 变化并生成金币
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
      // 只要更新 budget，组件就会自动感知并播放动画
      this.setData({ sliderValue: sliderVal, budget: realBudget });
      // this.generateCoins... <--- 【删除】
    }
  },
  
  // generateCoins(amount) { ... } <--- 【删除】整个函数都不需要了
  
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
      url: `https://api.seniverse.com/v3/weather/now.json?key=${SENIVERSE_KEY}&location=${lat}:${lon}&language=zh-Hans&unit=c`,
      method: 'GET',
      success: (res) => {
        console.log('心知天气返回:', res);

        if (res.statusCode === 200 && res.data.results) {
          const now = res.data.results[0].now;
          this.setData({
            weather: now.text,        
            temp: now.temperature     
          });
          wx.showToast({ title: `当地: ${now.text} ${now.temperature}°C`, icon: 'none' });
        } else {
          console.error('天气API异常:', res.data);
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
      weatherContext: `${this.data.weather}, ${this.data.temp}°C`
    };
    
    wx.navigateTo({
      url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(queryData))}`
    });
  }
});