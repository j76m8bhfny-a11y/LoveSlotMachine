// pages/result/result.js
const strategyData = require('../../utils/strategyData.js');
const locationService = require('../../utils/locationService.js');
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
    
    strategyQueue: [], 
    currentIndex: 0,
    
    analysisLogs: [],
    scrollTop: 0,
    reel1: [], reel2: [], reel3: [],

    // 记忆库 (去重用)
    historyIds: [], 
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
      currentIndex: 0,
      strategyQueue: [] 
      // 注意：这里不清空 historyIds，保留去重记忆
    });

    console.log('======== 🎰 启动抽奖流程 ========');
    console.log('当前记忆库(已屏蔽的店):', this.data.historyIds);

    this.startAnalysisSimulation(data);
    this.executeNextStrategy();
  },

  // pages/result/result.js

  // --- 🧠 核心：执行搜索 (V8.0 单点盲盒版) ---
  executeNextStrategy() {
    // 1. 初始化策略队列 (如果是首次运行)
    if (this.data.strategyQueue.length === 0) {
        const strategies = strategyData.getStrategies(this.data.inputData);
        strategies.sort(() => Math.random() - 0.5); // 策略包乱序
        this.setData({ strategyQueue: strategies });
        
        if (strategies.length === 0) {
            this.addLog({ type: 'error', text: 'AI 觉得这条件没法玩...' });
            return;
        }
    }

    const { strategyQueue, currentIndex } = this.data;

    // 2. 边界检查
    if (currentIndex >= strategyQueue.length) {
      this.addLog({ type: 'error', text: '搜遍全城也没找到更多合适的...' });
      this.setData({ isLoading: false, showReceipt: true, result: null });
      return;
    }

    // 3. 取出当前策略包
    const currentPack = strategyQueue[currentIndex];
    // 注意：这里不要急着 currentIndex + 1，因为如果这个包里的某个子分类没搜到，我们还要试包里的其他分类
    // 我们改用一个内部递归的方式来处理当前包的所有子分类

    const logText = `🛰️ [第${currentIndex + 1}轮] 锁定场景: ${currentPack.name}`;
    this.addLog({ type: 'search', text: logText });

    // 4. 🎲 核心逻辑：从当前包里随机选一个分类搜，搜不到就换一个，直到有结果
    // 将 "060101|110204" 拆分为 ['060101', '110204']
    const allTypes = currentPack.types.split('|');
    
    // 调用递归搜索函数
    this.searchSingleTypeRecursive(allTypes, currentPack, () => {
        // 如果当前包的所有子分类都试完了也没结果，就去下一个包
        this.setData({ currentIndex: currentIndex + 1 });
        this.executeNextStrategy();
    });
  },

  /**
   * ♻️ 递归搜索子分类
   * @param {Array} typeList - 待选的分类列表 ['060101', '110204']
   * @param {Object} pack - 当前策略包信息
   * @param {Function} onFail - 全都搜不到时的回调
   */
  searchSingleTypeRecursive(typeList, pack, onFail) {
    if (typeList.length === 0) {
        console.warn(`❌ ${pack.name} 下的所有分类都试过了，全军覆没`);
        onFail(); 
        return;
    }

    // 1. 随机抽一个 (比如抽中纪念馆)
    const randomIndex = Math.floor(Math.random() * typeList.length);
    const targetType = typeList[randomIndex];
    
    // 从列表中移除它，防止下次重复抽
    const remainingTypes = typeList.filter((_, i) => i !== randomIndex);

    console.log(`\n>>> 🎲 盲盒选中分类: ${targetType} (属于 ${pack.name})`);
    
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const userLoc = `${res.longitude},${res.latitude}`;
        
        // 2. 发起搜索 (只搜这一个类型)
        locationService.searchByType(targetType, userLoc).then(data => {
            console.log(`📡 API响应 [Code:${targetType}]:`, data);

            if (data && data.poisData && data.poisData.length > 0) {
                console.log(`📦 命中数量: ${data.poisData.length}`);
                
                // 3. 筛选
                const sortedCandidates = this.rankPois(data.poisData, this.data.inputData.budget, targetType);
                
                if (sortedCandidates.length > 0) {
                    // 🎉 搜到了！
                    // 这里的逻辑是：既然用户选择了"随机一个"，我们就在这一个分类里挑最好的
                    
                    // Top 3 随机 (增加一点点变数)
                    const topN = sortedCandidates.slice(0, 3);
                    const finalIndex = Math.floor(Math.random() * topN.length);
                    const bestPlace = topN[finalIndex];

                    // 记录历史
                    const newHistory = [...this.data.historyIds, bestPlace.name];
                    this.setData({ 
                        historyIds: newHistory,
                        currentIndex: this.data.currentIndex + 1 // 成功了才推进到下一个大策略
                    });

                    console.log(`✅ 最终选中: ${bestPlace.name}`);
                    this.addLog({ type: 'found', text: `✅ 发现宝藏：${bestPlace.name}` });
                    this.callAiToDecorate(bestPlace, pack.name);
                } else {
                    console.warn(`⚠️ [${targetType}] 有数据但被 rankPois 过滤完，重试下一个分类...`);
                    // 递归：试剩下的类型
                    this.searchSingleTypeRecursive(remainingTypes, pack, onFail);
                }
            } else {
                console.warn(`⚠️ [${targetType}] 高德返回 0 结果，重试下一个分类...`);
                // 递归：试剩下的类型
                this.searchSingleTypeRecursive(remainingTypes, pack, onFail);
            }
        });
      },
      fail: () => {
        this.addLog({ type: 'error', text: '请授权定位' });
        this.setData({ spinning: false });
      }
    });
  },

  /**
   * 🏆 V6.7 严厉分级过滤 (封杀荷花池/无关景点)
   */
  rankPois(pois, budget, allowedTypes) {
    const validPois = [];
    const userBudget = budget ? parseInt(budget) : 9999;
    const { historyIds } = this.data;

    console.group('🔍 V6.7 严厉筛选执行中...');

    pois.forEach((p) => {
        const name = p.name;
        const typeCode = p.typecode || '';
        const rating = (p.biz_ext && p.biz_ext.rating && p.biz_ext.rating.length > 0) 
                       ? parseFloat(p.biz_ext.rating) 
                       : 4.0; 
        const cost = (p.biz_ext && p.biz_ext.cost) ? parseInt(p.biz_ext.cost) : 0;
        
        // 0. 记忆去重
        if (historyIds.includes(name)) return;

        // 1. 防伪验毒
        if (allowedTypes && !allowedTypes.includes(typeCode)) return;

        // 2. 预算过滤
        if (cost > 0 && cost > userBudget * 1.5) return;

        // ===============================================
        // 🚦 3. 智能门槛 (非黑即白版)
        // ===============================================
        
        // 白名单：顶级分类 (世界遗产/国家级/动物园/植物园/博物馆/美术馆)
        const isPremiumType = /^(110201|110202|110102|110103|14)/.test(typeCode);
        
        // 黑名单逻辑：只要是 11 开头(风景)，但不是顶级，统统算普通！
        // 这能防住 110206(景点), 110209(观景台) 等漏网之鱼
        const isGenericType = typeCode.startsWith('11') && !isPremiumType;

        // 📉 设定门槛
        let minScore = 4.0; // 默认 (商场/娱乐)

        if (isPremiumType) {
            minScore = 4.0; // 顶级景点，3.5分放行
        } else if (isGenericType) {
            minScore = 4.0; // 普通景点(荷花池之流)，必须4.2分！
        }

        // 拦截名字像"市政设施"的
        if (name.includes('广场') || name.includes('服务') || name.includes('中心') || name.includes('大厦')) {
            if (!isPremiumType) minScore = 4.8; 
        }
        
        if (rating < minScore) {
             console.log(`[淘汰] ${name}: 评分不够硬 (需${minScore}, 实${rating})`);
             return; 
        }

        // ===============================================
        // ⚖️ 4. 权重计算 (评分 > 距离)
        // ===============================================
        let score = 0;
        
        // 评分权重 (极高)
        const effectiveRating = rating || 4.0; 
        score += effectiveRating * 15; // 权重加码

        // 距离权重 (极低)
        // 让20km的好店也能排前面
        const distanceKm = (p.distance || 0) / 1000;
        const distanceScore = Math.max(0, 10 - distanceKm * 0.3); // 距离影响很小
        score += distanceScore;

        if (p.photos && p.photos.length > 0) score += 5;
        if (cost === 0 || (cost > 0 && cost <= userBudget)) score += 10;

        p._score = score;
        validPois.push(p);
        
        console.log(`[晋级] ${name}: ${score.toFixed(1)}分 (评分:${rating}, 距离:${distanceKm.toFixed(1)}km)`);
    });

    console.groupEnd();

    // 排序
    validPois.sort((a, b) => b._score - a._score);
    return validPois;
  },

  callAiToDecorate(place, keyword) {
    // 别说"注入灵魂"了，太中二了
    this.addLog({ type: 'ai', text: '✨ 正在生成推荐理由...' }); 

    const requestData = { 
      ...this.data.inputData,
      realPlaceName: place.name,
      realPlaceAddress: place.address,
      keywordCategory: keyword,
      placeImage: (place.photos && place.photos.length) ? place.photos[0].url : ''
    };

    getAIRecommendation(requestData)
      .then(res => {
        // ... (后续逻辑不变)
      })
      // ...
  },

  startAnalysisSimulation(data) {
    const initialLogs = [
      { type: 'init', text: '🔍 正在全城搜索...' }, // 简单直接
      { type: 'weather', text: `☁️ 匹配天气：${data.weatherContext || '...'} ` },
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
    this.setData({ showReceipt: false, isLoading: true });
    this.pullLever();
  },

  shuffle(arr) { return arr.sort(() => 0.5 - Math.random()); },
  getRandom(arr, n) { return this.shuffle([...arr]).slice(0, n); },
  onImageLoad() { this.setData({ imageLoaded: true }); },
});