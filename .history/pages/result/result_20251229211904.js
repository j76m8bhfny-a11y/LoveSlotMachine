// pages/result/result.js
const strategyData = require('../../utils/strategyData.js'); // 引入新大脑
const locationService = require('../../utils/locationService.js'); // 引入新执行器
const { getAIRecommendation } = require('../../utils/api.js');

const ICONS = ['🍎', '🍋', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '💎'];

Page({
  data: {
    isLoading: true,
    spinning: false,
    showReceipt: false,
    imageLoaded: false,
    leverFrame: 0,
    isPulling: false,
    isFlowing: false,
    
    inputData: {},    
    result: null,     
    
    // V6.0 策略引擎
    strategyQueue: [], // 这里存的是策略包对象，不再是简单的关键词字符串
    currentIndex: 0,
    
    analysisLogs: [],
    scrollTop: 0,
    reel1: [], reel2: [], reel3: [],
  },

  onLoad(options) {
    this.setData({
      reel1: this.generateReel(),
      reel2: this.generateReel(),
      reel3: this.generateReel(),
    });

    if (options.data) {
      const inputData = JSON.parse(decodeURIComponent(options.data));
      this.setData({ inputData });
      setTimeout(() => { this.pullLever(inputData); }, 500);
    }
  },

  generateReel() {
    return Array.from({ length: 20 }, () => ICONS[Math.floor(Math.random() * ICONS.length)]);
  },

  pullLever(data) {
    if (this.data.isPulling) return;
    this.setData({ isPulling: true });
    this.setData({ leverFrame: 1 });
    setTimeout(() => {
      this.setData({ leverFrame: 2 });
      wx.vibrateShort({ type: 'heavy' }); 
      this.startSlotProcess(data || this.data.inputData); 
    }, 100);
    setTimeout(() => { this.setData({ leverFrame: 3 }); }, 300);
    setTimeout(() => { this.setData({ leverFrame: 0, isPulling: false }); }, 500);
  },

  startSlotProcess(data) {
    this.setData({ 
      spinning: true, 
      isFlowing: true,
      isLoading: true,
      showReceipt: false,
      analysisLogs: [],
      // 重置策略索引
      currentIndex: 0,
      strategyQueue: [] 
    });

    this.startAnalysisSimulation(data);
    this.executeNextStrategy();
  },

  // --- 🧠 核心：执行搜索 (V6.0 场景驱动版) ---
  executeNextStrategy() {
    // 1. 如果队列为空，先找大脑生成策略
    if (this.data.strategyQueue.length === 0) {
        const strategies = strategyData.getStrategies(this.data.inputData);
        this.setData({ strategyQueue: strategies });
        
        if (strategies.length === 0) {
            this.addLog({ type: 'error', text: '条件太苛刻，AI 找不到方案...' });
            return;
        }
    }

    const { strategyQueue, currentIndex } = this.data;

    // 2. 边界检查
    if (currentIndex >= strategyQueue.length) {
      this.addLog({ type: 'error', text: '搜遍全城也没找到合适的，建议降低预算或要求' });
      this.setData({ isLoading: false, showReceipt: true, result: null });
      return;
    }

    // 3. 取出当前策略包
    const currentPack = strategyQueue[currentIndex];
    this.setData({ currentIndex: currentIndex + 1 });

    this.addLog({ type: 'search', text: `🛰️ 正在扫描: ${currentPack.name} (${currentPack.desc})...` });

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const userLoc = `${res.longitude},${res.latitude}`;
        
        // 🚀 发起搜索 (按 Type Code 搜)
        locationService.searchByType(currentPack.types, userLoc).then(data => {
            if (data && data.poisData && data.poisData.length > 0) {
                // 4. ⚔️ 选妃环节 (传入 currentPack.types 用于验毒)
                const bestPlace = this.rankPois(data.poisData, this.data.inputData.budget, currentPack.types);

                if (bestPlace) {
                    this.addLog({ type: 'found', text: `✅ 优选结果：${bestPlace.name} (${bestPlace._score.toFixed(1)}分)` });
                    // 传入策略包名称 (如"文化漫步") 帮助 AI 写文案
                    this.callAiToDecorate(bestPlace, currentPack.name);
                } else {
                    console.warn(`[Result] ${currentPack.name} 结果被过滤器全杀（可能是API返回了兜底餐饮）`);
                    this.executeNextStrategy(); // 递归试下一个包
                }
            } else {
                console.warn(`[Result] ${currentPack.name} 没搜到结果`);
                this.executeNextStrategy();
            }
        });
      },
      fail: () => {
        this.addLog({ type: 'error', text: '需要定位权限才能推荐身边好店哦' });
        this.setData({ spinning: false });
      }
    });
  },

  /**
   * 🏆 V6.1 核心排名算法 (带防伪验毒)
   * @param {Array} pois - 高德返回的原始数据
   * @param {Number} budget - 用户预算
   * @param {String} allowedTypes - 允许的白名单 "110100|..."
   */
  rankPois(pois, budget, allowedTypes) {
    const validPois = [];
    const userBudget = budget ? parseInt(budget) : 9999;

    pois.forEach(p => {
        const rating = (p.biz_ext && p.biz_ext.rating) ? parseFloat(p.biz_ext.rating) : 0;
        const cost = (p.biz_ext && p.biz_ext.cost) ? parseInt(p.biz_ext.cost) : 0;
        const typeCode = p.typecode || '';

        // 🛡️ 1. 防伪验毒 (Anti-Spam)
        // 即使高德推了热门饭馆(05xxxx)，只要不在 allowedTypes 里，直接杀
        if (allowedTypes && !allowedTypes.includes(typeCode)) {
             // console.warn(`[剔除] 混入异类: ${p.name} (${typeCode})`);
             return; 
        }

        // 🛡️ 2. 垃圾过滤 (Hard Filter)
        if (rating > 0 && rating < 3.8) return; // 评分太低淘汰
        if (cost > 0 && cost > userBudget * 1.5) return; // 超预算淘汰

        // ⭐ 3. 计算加权分
        let score = 0;
        
        // A. 评分权重 (基准分 32)
        const effectiveRating = rating || 4.0; 
        score += effectiveRating * 8; 

        // B. 距离权重 (越近分越高)
        const distanceKm = (p.distance || 0) / 1000;
        const distanceScore = Math.max(0, 30 - distanceKm); 
        score += distanceScore;

        // C. 图片权重 (有图说明运营好)
        if (p.photos && p.photos.length > 0) score += 10;

        // D. 预算契合度 (免费或预算内加分)
        if (cost === 0 || cost <= userBudget) score += 20;

        p._score = score;
        validPois.push(p);
    });

    // 排序 (分高者得天下)
    validPois.sort((a, b) => b._score - a._score);

    return validPois.length > 0 ? validPois[0] : null;
  },

  // --- AI 润色 (保持不变) ---
  callAiToDecorate(place, keyword) {
    this.addLog({ type: 'ai', text: '🧠 AI正在为地点注入灵魂...' });

    const requestData = { 
      ...this.data.inputData,
      realPlaceName: place.name,
      realPlaceAddress: place.address,
      keywordCategory: keyword,
      placeImage: (place.photos && place.photos.length) ? place.photos[0].url : ''
    };

    getAIRecommendation(requestData)
      .then(res => {
        const finalResult = {
          ...res,
          location: place.name,
          address: place.address,
          imageUrl: requestData.placeImage || '' 
        };
        setTimeout(() => { this.handleSuccess(finalResult); }, 1500);
      })
      .catch(err => {
        console.error(err);
        this.addLog({ type: 'error', text: 'AI 脑路堵塞，重试中...' });
        this.setData({ spinning: false, isFlowing: false });
      });
  },

  // 辅助视觉函数 (保持不变)
  startAnalysisSimulation(data) {
    const relation = data.relation || '未知关系';
    const weather = data.weatherContext || '未知天气';
    const initialLogs = [
      { type: 'init', text: `正在读取 ${relation} 关系模型...` },
      { type: 'weather', text: `加载天气数据：${weather}...` },
    ];
    this.setData({ analysisLogs: initialLogs });
  },

  addLog(logItem) {
    const logs = this.data.analysisLogs;
    logs.push(logItem);
    this.setData({ analysisLogs: logs, scrollTop: logs.length * 100 });
    wx.vibrateShort({ type: 'light' });
  },

  handleSuccess(res) {
    const winIcon = '❤️';
    const winningReel = [ICONS[0], winIcon, ...ICONS]; 
    this.setData({ reel1: winningReel, reel2: winningReel, reel3: winningReel, spinning: false });
    setTimeout(() => { this.setData({ isFlowing: false }); }, 2500);
    setTimeout(() => wx.vibrateShort(), 100);
    setTimeout(() => wx.vibrateShort(), 600);
    setTimeout(() => wx.vibrateShort(), 1100);
    setTimeout(() => {
      this.setData({ result: res, isLoading: false, showReceipt: true });
      wx.vibrateLong(); 
    }, 2800); 
  },

  reRoll() {
    this.setData({ 
      // 注意：executeNextStrategy 里会自动 +1，这里保持即可，或者根据需求重置
      // 如果想彻底重搜，可以不改 currentIndex，直接调 pullLever 即可
      showReceipt: false,
      isLoading: true
    });
    this.pullLever();
  },

  shuffle(arr) { return arr.sort(() => 0.5 - Math.random()); },
  getRandom(arr, n) { return this.shuffle([...arr]).slice(0, n); },
  onImageLoad() { this.setData({ imageLoaded: true }); },
});