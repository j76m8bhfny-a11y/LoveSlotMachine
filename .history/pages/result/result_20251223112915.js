const api = require('../../utils/api.js');
// 预设图案池
const ICONS = ['🍎', '🍋', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '💎'];

Page({
  data: {
    // ...
    leverPulled: false, // 拉杆状态
    spinning: false,    // 滚动状态
    
    // 初始化滚轮数据 (每个放20个，足够滚动了)
    reel1: [],
    reel2: [],
    reel3: [],
  },

  onLoad(options) {
    // 初始化随机滚轮
    this.setData({
      reel1: this.generateReel(),
      reel2: this.generateReel(),
      reel3: this.generateReel(),
    });

  startProcess(data) {
    this.setData({ 
      isLoading: true, 
      spinning: true,
      analysisLogs: [] 
    });
    
    this.startAnalysisSimulation(data);

    const requestData = { ...data, retryCount: this.data.retryCount };
    
    api.getDatingAdvice(requestData)
      .then(res => {
        // 保证动画至少播完
        setTimeout(() => {
          this.handleSuccess(res);
        }, 3500); 
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'AI 脑路堵塞，重试一下', icon: 'none' });
        this.setData({ spinning: false });
      });
  },

  startAnalysisSimulation(data) {
    const logs = [];
    
    // 1. 关系
    if (data.relation.includes('初识')) {
      logs.push({ type: 'relation', text: '破冰模式启动！拒绝尴尬～' });
    } else if (data.relation.includes('热恋')) {
      logs.push({ type: 'relation', text: '检测到高甜反应！寻找私密角落...' });
    } else {
      logs.push({ type: 'relation', text: `正在为${data.relation}定制专属浪漫...` });
    }

    // 2. 天气
    if (data.weatherContext) {
      if (data.weatherContext.includes('雨')) {
        logs.push({ type: 'weather', text: '外面下雨啦，帮你找个躲雨的好地方！' });
      } else if (data.weatherContext.includes('3') && data.weatherContext.length < 5) {
         logs.push({ type: 'weather', text: '天气好热，一定要有空调才行！' });
      } else {
         logs.push({ type: 'weather', text: `天气不错哦，${data.weatherContext}` });
      }
    }

    // 3. 预算
    const budgetVal = parseInt(data.budget);
    if (budgetVal < 100) {
      logs.push({ type: 'budget', text: '省钱小能手！挖掘免费宝藏中...' });
    } else if (budgetVal > 1000) {
      logs.push({ type: 'budget', text: '预算充足！准备开启奢华体验～' });
    } else {
      logs.push({ type: 'budget', text: '收到预算，正在计算性价比最优解...' });
    }

    // 4. 收尾
    logs.push({ type: 'final', text: '灵感合成完毕！马上揭晓～' });

    let index = 0;
    this.logTimer = setInterval(() => {
      if (index < logs.length) {
        const newLog = logs[index];
        const currentLogs = this.data.analysisLogs;
        currentLogs.push(newLog);
        
        this.setData({ 
          analysisLogs: currentLogs,
          scrollTop: currentLogs.length * 100 
        });
        wx.vibrateShort({ type: 'light' });
        index++;
      } else {
        clearInterval(this.logTimer);
      }
    }, 1500);
  },

  handleSuccess(res) {
    clearInterval(this.logTimer);
    this.setData({ 
      result: res,
      spinning: false 
    });
    
    setTimeout(() => {
      this.setData({ isLoading: false, showReceipt: true });
      wx.vibrateLong(); 
    }, 500);
  },

  reRoll() {
    this.setData({ 
      showReceipt: false,
      retryCount: this.data.retryCount + 1 
    });
    this.startProcess(this.data.inputData);
  },

  onUnload() {
    if (this.logTimer) clearInterval(this.logTimer);
  }
});