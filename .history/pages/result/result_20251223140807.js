const api = require('../../utils/api.js');

// 预设图案池
const ICONS = ['🍎', '🍋', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '💎'];

Page({
  data: {
    isLoading: true,
    spinning: false,
    showReceipt: false,
    inputData: {},
    result: null,
    retryCount: 0,
    
    // 分析气泡相关
    analysisLogs: [],
    scrollTop: 0,
    
    // 滚轮数据
    reel1: [],
    reel2: [],
    reel3: [],

    // ✨ 像素拉杆动画状态
    leverFrame: 0, // 当前帧 (0-3)
    isPulling: false // 是否正在拉动中
  },

  onLoad(options) {
    // 初始化随机滚轮
    this.setData({
      reel1: this.generateReel(),
      reel2: this.generateReel(),
      reel3: this.generateReel(),
    });

    if (options.data) {
      const inputData = JSON.parse(decodeURIComponent(options.data));
      this.setData({ inputData });
      
      // 页面加载 0.5s 后自动拉杆
      setTimeout(() => {
        this.pullLever(inputData);
      }, 500);
    }
  },

  generateReel() {
    return Array.from({ length: 20 }, () => ICONS[Math.floor(Math.random() * ICONS.length)]);
  },

  // ✨✨ 核心：像素拉杆序列帧动画 ✨✨
  pullLever(data) {
    // 如果已经在拉动中，防止重复触发
    if (this.data.isPulling) return;
    
    this.setData({ isPulling: true });

    // 动画序列：0 -> 1 -> 2 (触底) -> 3 (回弹) -> 0
    
    // Step 1: 蓄力 (Frame 1)
    this.setData({ leverFrame: 1 });

    // Step 2: 触底 (Frame 2) - 100ms后
    setTimeout(() => {
      this.setData({ leverFrame: 2 });
      wx.vibrateShort({ type: 'heavy' }); // 触底震动，更有手感
      
      // 触底瞬间，触发老虎机逻辑
      this.startSlotProcess(data || this.data.inputData); 
    }, 100);

    // Step 3: 回弹 (Frame 3) - 300ms后
    setTimeout(() => {
      this.setData({ leverFrame: 3 });
    }, 300);

    // Step 4: 归位 (Frame 0) - 500ms后
    setTimeout(() => {
      this.setData({ 
        leverFrame: 0, 
        isPulling: false 
      });
    }, 500);
  },

  // 老虎机业务逻辑 (转动 -> API -> 停止)
  startSlotProcess(data) {
    this.setData({ 
      spinning: true, // CSS 无限滚动开始
      isLoading: true,
      showReceipt: false,
      analysisLogs: [] 
    });
    
    this.startAnalysisSimulation(data);
    this.callAiApi(data);
  },

  callAiApi(data) {
    const requestData = { ...data, retryCount: this.data.retryCount };
    
    api.getDatingAdvice(requestData)
      .then(res => {
        // 至少等待3.5秒，让分析动画播一会儿
        setTimeout(() => {
          this.handleSuccess(res);
        }, 3500); 
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'AI 脑路堵塞，重试一下', icon: 'none' });
        this.setData({ spinning: false });
        clearInterval(this.logTimer);
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
    if (this.logTimer) clearInterval(this.logTimer);
    this.logTimer = setInterval(() => {
      if (index < logs.length) {
        const newLog = logs[index];
        const currentLogs = this.data.analysisLogs;
        currentLogs.push(newLog);
        this.setData({ analysisLogs: currentLogs, scrollTop: currentLogs.length * 100 });
        wx.vibrateShort({ type: 'light' });
        index++;
      } else {
        clearInterval(this.logTimer);
      }
    }, 1500); // 1.5秒一条
  },

  handleSuccess(res) {
    clearInterval(this.logTimer);
    const winIcon = '❤️';
    const winningReel = [ICONS[0], winIcon, ...ICONS]; 

    this.setData({
      reel1: winningReel,
      reel2: winningReel,
      reel3: winningReel,
    });

    this.setData({ spinning: false });
    
    // 模拟依次停下的震动
    setTimeout(() => wx.vibrateShort(), 100);
    setTimeout(() => wx.vibrateShort(), 600);
    setTimeout(() => wx.vibrateShort(), 1100);

    setTimeout(() => {
      this.setData({ 
        result: res,
        isLoading: false, 
        showReceipt: true 
      });
      wx.vibrateLong(); 
    }, 2500); 
  },

  // 重试逻辑：也调用 pullLever 来触发动画
  reRoll() {
    this.setData({ retryCount: this.data.retryCount + 1 });
    // 手动触发拉杆动画 + 重新请求
    this.pullLever();
  },

  onUnload() {
    if (this.logTimer) clearInterval(this.logTimer);
  }
});