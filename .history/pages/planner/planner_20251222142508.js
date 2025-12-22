const app = getApp();

Page({
  data: {
    relations: ['小心翼翼 (初识)', '小鹿乱撞 (暧昧)', '如胶似漆 (热恋)', '相爱相杀 (磨合)', '老夫老妻 (稳定)'],
    selectedRelation: 2, // 默认热恋
    times: [
      { name: '清晨', icon: '🌅', bg: 'bg-morning' },
      { name: '上午', icon: '☀️', bg: 'bg-am' },
      { name: '下午', icon: '☕', bg: 'bg-pm' },
      { name: '夜晚', icon: '🌙', bg: 'bg-night' }
    ],
    selectedTime: 2, // 默认下午
    timeBgClass: 'bg-pm',
    budget: 500,
    coinString: '',
    date: '2025-05-20',
    locationName: '获取当前位置'
  },

  onLoad() {
    // 设置默认日期为今天
    const today = new Date().toISOString().substring(0, 10);
    this.setData({ date: today });
    this.updateCoinPile(500);
    this.getLocation();
  },

  // 1. 关系选择
  selectRelation(e) {
    this.setData({ selectedRelation: e.currentTarget.dataset.index });
    wx.vibrateShort(); // 震动反馈
  },

  // 2. 时间选择
  selectTime(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({
      selectedTime: idx,
      timeBgClass: this.data.times[idx].bg
    });
    wx.vibrateShort();
  },

  // 3. 预算变动 & 金币生成逻辑
  onBudgetChange(e) {
    const val = e.detail.value;
    this.setData({ budget: val });
    this.updateCoinPile(val);
  },

  updateCoinPile(amount) {
    // 简单的视觉hack：根据金额数量生成一堆金币emoji字符串
    const count = Math.floor(amount / 100); 
    let str = "";
    for(let i=0; i<count; i++) {
      str += "💰"; 
      if (Math.random() > 0.8) str += "💵"; // 偶尔混入钞票
    }
    this.setData({ coinString: str });
  },

  // 4. 定位
  getLocation() {
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        // 实际开发需要调用地图逆地址解析API，这里仅做模拟
        this.setData({ locationName: '我的附近 (已定位)' });
      },
      fail: () => {
        this.setData({ locationName: '手动选择城市' });
      }
    });
  },
  
  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({ locationName: res.name || '已选位置' });
      }
    });
  },

  bindDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  // 提交
  submitConfig() {
    // 整理数据传给结果页
    const queryData = {
      relation: this.data.relations[this.data.selectedRelation],
      time: this.data.times[this.data.selectedTime].name,
      budget: this.data.budget,
      location: this.data.locationName,
      date: this.data.date
    };
    
    // 转换为字符串传递
    const queryString = JSON.stringify(queryData);
    
    wx.navigateTo({
      url: `/pages/result/result?data=${encodeURIComponent(queryString)}`
    });
  }
});