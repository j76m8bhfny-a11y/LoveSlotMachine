const app = getApp();
// 简单的音效管理器 (实际开发需引入音频文件)
const audioCtx = wx.createInnerAudioContext();

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
    
    budget: 500,
    coins: [], // 存储金币对象 {id, left, rotate, type}
    
    date: '2025-05-20',
    locationName: '📍 点击定位'
  },

  onLoad() {
    const today = new Date().toISOString().substring(0, 10);
    this.setData({ date: today });
    this.generateCoins(500); // 初始化金币
    this.playBGM();
  },

  playBGM() {
    // 可以在这里播放背景白噪音
  },

  playClickSound() {
    // audioCtx.src = '/assets/audio/pop.mp3';
    // audioCtx.play();
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

  onBudgetChange(e) {
    const val = e.detail.value;
    // 节流处理，避免频繁渲染
    if (Math.abs(val - this.data.budget) > 50) {
      this.setData({ budget: val });
      this.generateCoins(val);
      wx.vibrateShort({ type: 'medium' }); // 模拟机械齿轮感
    }
  },

  // ✨ 核心视觉逻辑：生成金币堆
  generateCoins(amount) {
    const count = Math.min(Math.floor(amount / 100), 40); // 限制最大视觉数量为40，防卡顿
    let newCoins = [];
    for (let i = 0; i < count; i++) {
      newCoins.push({
        id: i,
        type: Math.random() > 0.8 ? '💵' : '💰', // 20%概率出现钞票
        left: Math.floor(Math.random() * 90), // 0% - 90% 随机水平位置
        rotate: Math.floor(Math.random() * 60 - 30), // -30deg 到 30deg 旋转
        animDelay: Math.random() * 0.5 // 随机下落延迟
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
        // 模拟
        this.setData({ locationName: '杭州·滨江' });
      }
    });
  },

  bindDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  submitConfig() {
    const queryData = {
      relation: this.data.relations[this.data.selectedRelation].label,
      time: this.data.times[this.data.selectedTime].name,
      budget: this.data.budget,
      location: this.data.locationName,
      date: this.data.date
    };
    
    // 播放投币音效
    // audioCtx.src = '/assets/audio/coin_insert.mp3';
    // audioCtx.play();

    wx.navigateTo({
      url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(queryData))}`
    });
  }
});