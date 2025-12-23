const app = getApp();
// 简单的音效管理器 (实际开发需引入音频文件)
const audioCtx = wx.createInnerAudioContext();
const SENIVERSE_KEY = SJJOIA7A76gQjzQjc"; 

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
    
    // ✨ 修改点 1: 数据初始化
    // 我们分离了“显示金额”和“滑块刻度”
    budget: 200, // 默认金额设为200（黄金区间）
    sliderValue: 34, // 对应200元在0-100刻度尺上的位置
    
    coins: [], 
    date: '2025-05-20',
    locationName: '📍 点击定位',
    weather: '未知', // 晴/雨
    temp: '25'      // 温度
  },

  onLoad() {
    const today = new Date().toISOString().substring(0, 10);
    
    // ✨ 修改点 2: 初始化计算
    // 页面加载时，根据默认金额计算滑块应该在的位置
    const initialBudget = 200;
    this.setData({ 
      date: today,
      budget: initialBudget,
      sliderValue: this.budgetToSlider(initialBudget) // <--- 调用反向映射函数
    });
    this.generateCoins(initialBudget); 
    this.playBGM();

    // ✨ 进页面自动尝试获取一次定位（可选）
    this.getLocation(); 
  },

  playBGM() {
    // 可以在这里播放背景白噪音
  },

  playClickSound() {
    wx.vibrateShort({ type: 'light' });
  },

  selectRelation(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ selectedRelation: idx });
    this.playClickSound();
  },

  selectTime(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({
      selectedTime: idx,
      pageBgClass: this.data.times[idx].bg
    });
    this.playClickSound();
  },

  // ============================================================
  // ✨ 重点修改部分：非线性预算映射逻辑 (核心算法)
  // ============================================================
  
  // 输入: 0-100 (Slider物理刻度) 
  // 输出: 真实预算金额
  sliderToBudget(val) {
    // ✨✨ 核心修复：自动容错处理 ✨✨
    // 问题原因：如果 WXML 里的 slider max 还是 5000，传入的 val 会很大（如 2500）
    // 导致下面 (val - 80) * 200 算出一个天文数字。
    // 修复：检测到数值过大时，自动按比例归一化到 0-100 范围。
    if (val > 100) {
      val = (val / 5000) * 100;
    }

    let budget = 0;
    if (val <= 10) {
      // 区间1: 0-10% -> 0-50元 (穷游，每格5元)
      budget = val * 5; 
    } else if (val <= 50) {
      // 区间2: 10-50% -> 50-300元 (黄金区间，占据40%的滑动行程，方便微调) <--- 重点优化
      // 算法: 起始金额 + (当前进度 - 区间起始进度) * (区间金额跨度 / 区间进度跨度)
      budget = 50 + (val - 10) * 6.25; 
    } else if (val <= 80) {
      // 区间3: 50-80% -> 300-1000元 (进阶)
      budget = 300 + (val - 50) * 23.33; 
    } else {
      // 区间4: 80-100% -> 1000-5000元 (土豪，变化极快)
      budget = 1000 + (val - 80) * 200; 
    }
    // 取整到10元，保持数字整洁
    return Math.floor(budget / 10) * 10; 
  },

  // 反向映射: 真实金额 -> 0-100 (Slider物理刻度)
  // 用于初始化时，根据金额反推滑块应该在哪
  budgetToSlider(budget) {
     if (budget <= 50) return budget / 5;
     if (budget <= 300) return 10 + (budget - 50) / 6.25;
     if (budget <= 1000) return 50 + (budget - 300) / 23.33;
     return 80 + (budget - 1000) / 200;
  },

  // ✨ 修改点 3: 滑动事件处理
  onBudgetChange(e) {
    const sliderVal = e.detail.value; // 获取滑块的值
    const realBudget = this.sliderToBudget(sliderVal); // 转换为真实金额
    
    // 性能优化：只有当计算出的金额数字发生变化时，才更新UI和震动
    if (realBudget !== this.data.budget) {
      this.setData({ 
        sliderValue: sliderVal, // 保持滑块跟手
        budget: realBudget      // 更新显示金额
      });
      this.generateCoins(realBudget);
      
      // 震动反馈
      wx.vibrateShort({ type: 'light' }); 
    }
  },

  // ✨ 修改点 4: 金币生成逻辑优化
  generateCoins(amount) {
    let count = 0;
    // 根据金额分段设置金币数量，防止大金额产生几千个DOM节点导致卡顿
    if (amount < 200) count = Math.floor(amount / 20); 
    else if (amount < 1000) count = 10 + Math.floor((amount - 200) / 80); 
    else count = 20 + Math.floor((amount - 1000) / 200); 
    
    count = Math.min(count, 40); // 强制封顶40个

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

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({ locationName: res.name || '已选位置' });
      },
      fail: () => {
        this.setData({ locationName: '杭州·滨江' });
      }
    });
  },

  bindDateChange(e) {
    this.setData({ date: e.detail.value });
  },

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