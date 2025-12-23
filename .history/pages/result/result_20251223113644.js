const api = require('../../utils/api.js');

// 预设图案池 (用于老虎机滚动)
const ICONS = ['🍎', '🍋', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '💎'];

Page({
  data: {
    isLoading: true,    // 是否处于等待/加载状态
    spinning: false,    // 是否正在转动（CSS动画类名控制）
    leverPulled: false, // 拉杆是否被拉下
    showReceipt: false, // 是否显示结果小票
    
    inputData: {},      // 上一页传来的参数
    result: null,       // AI 返回的结果
    retryCount: 0,      // 重试次数
    
    // 分析气泡相关
    analysisLogs: [],   // 存储日志列表
    scrollTop: 0,       // 控制滚动条位置
    
    // 滚轮数据
    reel1: [],
    reel2: [],
    reel3: []
  },

  onLoad(options) {
    // 1. 初始化随机滚轮 (先填满图标，保证有东西显示)
    this.setData({
      reel1: this.generateReel(),
      reel2: this.generateReel(),
      reel3: this.generateReel(),
    });

    if (options.data) {
      const inputData = JSON.parse(decodeURIComponent(options.data));
      this.setData({ inputData });
      
      // 2. 页面加载 0.5s 后自动拉杆，开始流程
      setTimeout(() => {
        this.triggerSlotMachine(inputData);
      }, 500);
    }
  },

  // 生成一个包含20个图标的随机数组
  generateReel() {
    return Array.from({ length: 20 }, () => ICONS[Math.floor(Math.random() * ICONS.length)]);
  },

  // ✨ 触发老虎机全流程 (拉杆 -> 转动 -> 分析 -> API)
  triggerSlotMachine(data) {
    // A. 拉杆动画
    this.setData({ leverPulled: true });
    wx.vibrateShort({ type: 'heavy' }); // 拉动震动

    // B. 0.3s 后拉杆回弹，滚轮开始无限滚动
    setTimeout(() => {
      this.setData({ 
        leverPulled: false,
        spinning: true, // 开启 CSS 无限滚动动画
        isLoading: true,
        showReceipt: false,
        analysisLogs: [] // 清空旧日志
      });
      
      // C. 同时启动“分析气泡”模拟器
      this.startAnalysisSimulation(data);

      // D. 发起 AI 请求 (实际业务)
      this.callAiApi(data);
      
    }, 300);
  },

  // 调用 AI 接口
  callAiApi(data) {
    const requestData = { ...data, retryCount: this.data.retryCount };
    
    api.getDatingAdvice(requestData)
      .then(res => {
        // 请求成功后，调用停止逻辑
        // 延迟 3.5秒 是为了让分析气泡动画至少播一会儿，太快了没体验
        setTimeout(() => {
          this.handleSuccess(res);
        }, 3500); 
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'AI 脑路堵塞，重试一下', icon: 'none' });
        this.setData({ spinning: false }); // 停止转动
        clearInterval(this.logTimer);      // 停止打字
      });
  },

  // ✨ 核心逻辑：模拟分析师打字效果
  startAnalysisSimulation(data) {
    const logs = [];
    
    // 1. 关系分析
    if (data.relation.includes('初识') || data.relation.includes('小心')) {
      logs.push({ type: 'relation', text: '破冰模式启动！拒绝尴尬～' });
    } else if (data.relation.includes('热恋')) {
      logs.push({ type: 'relation', text: '检测到高甜反应！寻找私密角落...' });
    } else {
      logs.push({ type: 'relation', text: `正在为${data.relation}定制专属浪漫...` });
    }

    // 2. 天气分析
    if (data.weatherContext) {
      if (data.weatherContext.includes('雨')) {
        logs.push({ type: 'weather', text: '外面下雨啦，帮你找个躲雨的好地方！' });
      } else if (data.weatherContext.includes('3') && data.weatherContext.length < 5) { // 简单判断高温
         logs.push({ type: 'weather', text: '天气好热，一定要有空调才行！' });
      } else {
         logs.push({ type: 'weather', text: `天气不错哦，${data.weatherContext}` });
      }
    }

    // 3. 预算分析
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

    // 定时器逐个弹出
    let index = 0;
    // 先清理可能存在的旧定时器
    if (this.logTimer) clearInterval(this.logTimer);
    
    this.logTimer = setInterval(() => {
      if (index < logs.length) {
        const newLog = logs[index];
        const currentLogs = this.data.analysisLogs;
        currentLogs.push(newLog);
        
        this.setData({ 
          analysisLogs: currentLogs,
          scrollTop: currentLogs.length * 100 // 自动滚动到底部
        });
        
        wx.vibrateShort({ type: 'light' }); // 啵啵声/震动
        index++;
      } else {
        clearInterval(this.logTimer);
      }
    }, 1500); // 1.5秒弹一个，节奏比较舒服
  },

  // ✨ 成功拿到数据，准备停机
  handleSuccess(res) {
    // 1. 停止“分析”打字机
    clearInterval(this.logTimer);

    // 2. 准备中奖图案 (三个爱心)
    const winIcon = '❤️';
    
    // 3. 偷梁换柱：构造必中数组
    // 将数组前几个强制替换为 ❤️，当 CSS 动画移除时，transform 会让它们停在这个位置
    const winningReel = [ICONS[0], winIcon, ...ICONS]; 

    this.setData({
      reel1: winningReel,
      reel2: winningReel,
      reel3: winningReel,
    });

    // 4. 依次刹车 (视觉效果)
    // 移除 spinning 类名，CSS transition 会接管，让它们平滑滑到顶部
    this.setData({ spinning: false });
    
    // 震动三下，模拟三个滚轮依次停下的机械感
    // 注意：部分安卓机型对密集震动支持不佳，间隔设大一点
    setTimeout(() => wx.vibrateShort(), 100);
    setTimeout(() => wx.vibrateShort(), 600);
    setTimeout(() => wx.vibrateShort(), 1100);

    // 5. 展示结果小票 (延迟2.5秒等待滚轮完全停稳)
    setTimeout(() => {
      this.setData({ 
        result: res,
        isLoading: false, 
        showReceipt: true 
      });
      wx.vibrateLong(); // 出票长震动
    }, 2500); 
  },

  // 用户点击重试
  reRoll() {
    this.setData({ 
      retryCount: this.data.retryCount + 1 
    });
    // 再次触发完整流程
    this.triggerSlotMachine(this.data.inputData);
  },

  onUnload() {
    if (this.logTimer) clearInterval(this.logTimer);
  }
});