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

  // --- 🧠 核心：执行搜索 ---
  executeNextStrategy() {
    // 1. 生成策略
    if (this.data.strategyQueue.length === 0) {
        const strategies = strategyData.getStrategies(this.data.inputData);
        // 洗牌策略，保证随机性
        strategies.sort(() => Math.random() - 0.5);
        this.setData({ strategyQueue: strategies });
        console.log('🎲 生成策略队列:', strategies.map(s => s.name));
        
        if (strategies.length === 0) {
            this.addLog({ type: 'error', text: 'AI 觉得这条件没法玩...' });
            return;
        }
    }

    const { strategyQueue, currentIndex } = this.data;

    // 2. 边界检查
    if (currentIndex >= strategyQueue.length) {
      console.warn('⚠️ 所有策略包都试过了，实在找不到更多结果了。');
      this.addLog({ type: 'error', text: '搜遍全城也没找到更多合适的...' });
      this.setData({ isLoading: false, showReceipt: true, result: null });
      return;
    }

    // 3. 取出当前策略
    const currentPack = strategyQueue[currentIndex];
    this.setData({ currentIndex: currentIndex + 1 });

    const logText = `🛰️ [第${currentIndex + 1}轮] 扫描: ${currentPack.name}`;
    this.addLog({ type: 'search', text: logText });
    console.log(`\n>>> 开始执行策略: ${currentPack.name} (ID: ${currentPack.id})`);
    console.log(`>>> 目标TypeCodes: ${currentPack.types}`);

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const userLoc = `${res.longitude},${res.latitude}`;
        
        locationService.searchByType(currentPack.types, userLoc).then(data => {
            // 🐛🐛🐛 打印高德原始返回数据 🐛🐛🐛
            console.log(`📡 高德API响应 [${currentPack.name}]:`, data);

            if (data && data.poisData && data.poisData.length > 0) {
                console.log(`📦 原始候选数量: ${data.poisData.length} 个`);
                
                // 4. 选妃
                const sortedCandidates = this.rankPois(data.poisData, this.data.inputData.budget, currentPack.types);
                
                console.log(`🏆 最终入围数量: ${sortedCandidates.length} 个`);

                if (sortedCandidates.length > 0) {
                    // Top 5 随机
                    const topN = sortedCandidates.slice(0, 5);
                    const randomIndex = Math.floor(Math.random() * topN.length);
                    const bestPlace = topN[randomIndex];

                    // 记录到历史
                    const newHistory = [...this.data.historyIds, bestPlace.name];
                    this.setData({ historyIds: newHistory });

                    console.log(`✅ 最终选中: ${bestPlace.name} (评分:${bestPlace._score})`);
                    this.addLog({ type: 'found', text: `✅ 优选结果：${bestPlace.name}` });
                    this.callAiToDecorate(bestPlace, currentPack.name);
                } else {
                    console.warn(`❌ ${currentPack.name} 有原始数据，但被 rankPois 全部过滤了`);
                    this.executeNextStrategy(); 
                }
            } else {
                console.warn(`❌ ${currentPack.name} 高德返回空数据 (0 results)`);
                this.executeNextStrategy();
            }
        });
      },
      fail: (err) => {
        console.error('定位失败:', err);
        this.addLog({ type: 'error', text: '请授权定位' });
        this.setData({ spinning: false });
      }
    });
  },

  /**
   * 🏆 排名 + 验毒 + 打印日志
   */
  /**
   * 🏆 V6.5 智能分级排序算法 (降权距离 + 严格分级)
   */
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
        let minScore = 3.8; // 默认 (商场/娱乐)

        if (isPremiumType) {
            minScore = 3.5; // 顶级景点，3.5分放行
        } else if (isGenericType) {
            minScore = 4.2; // 普通景点(荷花池之流)，必须4.2分！
        }

        // 拦截名字像"市政设施"的
        if (name.includes('广场') || name.includes('服务') || name.includes('中心') || name.includes('大厦')) {
            if (!isPremiumType) minScore = 4.5; 
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
  }

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
        console.error('AI API Error:', err);
        this.addLog({ type: 'error', text: 'AI 脑路堵塞，重试中...' });
        this.setData({ spinning: false, isFlowing: false });
      });
  },

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
    this.setData({ showReceipt: false, isLoading: true });
    this.pullLever();
  },

  shuffle(arr) { return arr.sort(() => 0.5 - Math.random()); },
  getRandom(arr, n) { return this.shuffle([...arr]).slice(0, n); },
  onImageLoad() { this.setData({ imageLoaded: true }); },
});