// 引入核心模块
const { KEYWORD_POOLS } = require('../../utils/strategyData.js');
const locationService = require('../../utils/locationService.js');
const { getAIRecommendation } = require('../../utils/api.js');

// 预设图案池
const ICONS = ['🍎', '🍋', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '💎'];

Page({
  data: {
    // --- 视觉状态 ---
    isLoading: true,
    spinning: false,
    showReceipt: false,
    imageLoaded: false,
    leverFrame: 0,
    isPulling: false,
    isFlowing: false, // 流光呼吸
    
    // --- 核心数据 ---
    inputData: {},    // 用户上一页填写的参数
    result: null,     // 最终结果
    
    // --- 策略引擎 ---
    keywordQueue: [], // 关键词队列 ['猫咖', '电影院'...]
    currentIndex: 0,  // 当前搜到第几个词了
    
    // --- 动画数据 ---
    analysisLogs: [],
    scrollTop: 0,
    reel1: [], reel2: [], reel3: [],
  },

  onLoad(options) {
    // 1. 初始化滚轮
    this.setData({
      reel1: this.generateReel(),
      reel2: this.generateReel(),
      reel3: this.generateReel(),
    });

    if (options.data) {
      const inputData = JSON.parse(decodeURIComponent(options.data));
      this.setData({ inputData });
      
      // 2. 页面加载 0.5s 后自动拉杆
      setTimeout(() => {
        this.pullLever(inputData);
      }, 500);
    }
  },

  generateReel() {
    return Array.from({ length: 20 }, () => ICONS[Math.floor(Math.random() * ICONS.length)]);
  },

  // ✨✨ 视觉：像素拉杆动画 (保持不变) ✨✨
  pullLever(data) {
    if (this.data.isPulling) return;
    this.setData({ isPulling: true });

    // Frame 1: 蓄力
    this.setData({ leverFrame: 1 });

    // Frame 2: 触底 (触发业务逻辑)
    setTimeout(() => {
      this.setData({ leverFrame: 2 });
      wx.vibrateShort({ type: 'heavy' }); 
      
      // 🔥 核心入口：开始处理
      this.startSlotProcess(data || this.data.inputData); 
    }, 100);

    // Frame 3: 回弹
    setTimeout(() => { this.setData({ leverFrame: 3 }); }, 300);

    // Frame 0: 归位
    setTimeout(() => { 
      this.setData({ leverFrame: 0, isPulling: false });
    }, 500);
  },

  // ✨✨ 逻辑：老虎机启动 (重构版) ✨✨
  startSlotProcess(data) {
    // 1. 重置界面状态
    this.setData({ 
      spinning: true, 
      isFlowing: true,
      isLoading: true,
      showReceipt: false,
      analysisLogs: [],
      // 如果是第一次进来，currentIndex 归零；如果是换一个，保持 index 递增
    });

    // 2. 如果队列还没生成 (第一次运行)，先生成策略队列
    if (this.data.keywordQueue.length === 0) {
      this.generateKeywordQueue(data);
    }
    
    // 3. 启动日志动画 (只是视觉效果)
    this.startAnalysisSimulation(data);

    // 4. 🔥 核心：执行搜索策略 (找地 -> 找AI)
    this.executeNextStrategy();
  },

  // --- 🧠 核心 1：生成策略队列 ---
  generateKeywordQueue(data) {
    const { weatherContext, relation } = data;
    
    // -------------------------------------------
    // 1. 🌡️ 温度与天气感知 (决定 Indoor 还是 Outdoor)
    // -------------------------------------------
    let temp = 25;
    const tempMatch = (weatherContext || '').match(/(-?\d+)/);
    if (tempMatch) temp = parseInt(tempMatch[0]);
    const isRaining = /雨|雪|暴|沙/.test(weatherContext || '');
    
    // 逻辑：下雨 OR 太热(>30) OR 太冷(<5) -> 必须室内
    // 这里的 30 和 5 是人体舒适阈值，超过就不适合在外面逛一天了
    const isBadWeather = isRaining || temp > 30 || temp < 5;
    const envKey = isBadWeather ? 'indoor' : 'outdoor';

    console.log(`[决策] 天气:${weatherContext} 温度:${temp} -> 环境:${envKey}`);

    // -------------------------------------------
    // 2. ❤️ 情感状态感知 (决定 Safe 还是 Intimate)
    // -------------------------------------------
    // 初识/暧昧 -> 需要安全感、话题、避免尴尬 -> Safe池
    // 热恋/稳定 -> 需要互动、肢体接触、新鲜感 -> Intimate池
    
    let emotionKey = 'safe'; // 默认安全牌
    if (relation === '如胶似漆' || relation === '相爱相杀' || relation === '老夫老妻') {
      emotionKey = 'intimate';
    }

    console.log(`[决策] 关系:${relation} -> 风格:${emotionKey}`);

    // -------------------------------------------
    // 3. 🎱 取词与混合
    // -------------------------------------------
    // 主策略
    let pool = [...KEYWORD_POOLS[envKey][emotionKey]];

    // 💡 策略补充：
    // 如果是"老夫老妻"(稳定)，有时候反而喜欢去"初识"的地方找回忆，
    // 或者如果是"热恋"，有时候也想去"公园"散步。
    // 所以我们混入 30% 对方池子的词，防止太单调。
    const otherKey = emotionKey === 'safe' ? 'intimate' : 'safe';
    pool = pool.concat(this.getRandom(KEYWORD_POOLS[envKey][otherKey], 3));

    // 洗牌
    const queue = this.shuffle(pool);
    
    this.setData({ 
      keywordQueue: queue,
      currentIndex: 0
    });
  },

  // --- 🧠 核心 2：执行搜索 (递归回落逻辑) ---
  executeNextStrategy() {
    // 1. 如果是第一次运行，生成策略队列
    if (!this.data.keywordQueue || this.data.keywordQueue.length === 0) {
        // 根据用户输入生成策略包列表
        const strategies = strategyData.getStrategies(this.data.inputData);
        // 这里我们将整个策略对象存入队列，而不仅仅是关键词
        this.setData({ keywordQueue: strategies, currentIndex: 0 });
        
        if (strategies.length === 0) {
            this.addLog({ type: 'error', text: '当前条件太苛刻，AI 找不到方案...' });
            return;
        }
    }

    const { keywordQueue, currentIndex } = this.data;

    // 2. 边界检查
    if (currentIndex >= keywordQueue.length) {
      this.addLog({ type: 'error', text: '搜遍全城也没找到合适的，降低标准试试？' });
      this.setData({ isLoading: false, showReceipt: true, result: null });
      return;
    }

    // 3. 取出当前策略包 (一次取1个包搜即可，因为一个包里包含了很多类型)
    const currentPack = keywordQueue[currentIndex];
    this.setData({ currentIndex: currentIndex + 1 });

    this.addLog({ type: 'search', text: `🛰️ 正在扫描: ${currentPack.name} (${currentPack.desc})...` });

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const userLoc = `${res.longitude},${res.latitude}`;
        
        // 🚀 发起搜索 (按编码搜)
        locationService.searchByType(currentPack.types, userLoc).then(data => {
            if (data && data.poisData && data.poisData.length > 0) {
                // 4. ⚔️ 选妃环节 (过滤 + 排序)
                const bestPlace = this.rankPois(data.poisData, this.data.inputData.budget);

                if (bestPlace) {
                    this.addLog({ type: 'found', text: `✅ 优选结果：${bestPlace.name} (${bestPlace._score.toFixed(1)}分)` });
                    // 传入策略包的名称作为关键词，帮助 AI 写文案
                    this.callAiToDecorate(bestPlace, currentPack.name);
                } else {
                    console.warn(`[Result] ${currentPack.name} 搜到了但都被过滤了`);
                    this.executeNextStrategy(); // 递归试下一个包
                }
            } else {
                console.warn(`[Result] ${currentPack.name} 没搜到任何结果`);
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

  // ✨✨✨ 终极纯净版：所见即所得 (WYSIWYG) ✨✨✨
  // ✨✨✨ 3.1 修正版：信任高德分类，仅拦截黑名单 ✨✨✨
  isValidDateSpot(place, searchKeyword) {
    const name = (place.name || '').toLowerCase();
    const type = (place.type || '').toLowerCase();
    
    // ===========================================
    // 1. ⛔️ 基础黑名单 (防一些源头没防住的杂项)
    // ===========================================
    const blackList = [
      '银行', 'atm', '营业厅', '中介', '房产', '物流', '快递', '驿站', '邮政',
      '公司', '厂', '园区', '大厦', '办事处', '委员会', '党群', '居委会',
      '学校', '培训', '驾校', '幼儿园', '小学', '中学', '大学',
      '派出所', '公安', '政府', '法院', '医院', '卫生院', '药房',
      '公厕', '垃圾', '停车场', '收费站', '加油站', '加水', '维修', '汽修',
      '批发', '五金', '建材'
    ];
    
    // 如果名字 OR 类型 包含黑名单词，直接毙掉
    if (blackList.some(bad => name.includes(bad) || type.includes(bad))) {
      return false; 
    }

    // ===========================================
    // 2. 🟢 信任放行
    // ===========================================
    // 因为 locationService 已经保证了：
    // 搜爬山只会返回 110000(风景名胜)，搜滑雪只会返回 080000(体育)
    // 所以这里不需要再校验 "名字里有没有山" 了。
    // 只要不是黑名单，就直接通过！
    
    return true;
  },

  // --- 🧠 核心 3：AI 润色 ---
  callAiToDecorate(place, keyword) {
    this.addLog({ type: 'ai', text: '🧠 AI正在为地点注入灵魂...' });

    const requestData = { 
      ...this.data.inputData,
      realPlaceName: place.name,
      realPlaceAddress: place.address,
      keywordCategory: keyword,
      // 还可以传 place.photos[0].url 给 AI 参考，或者直接前端显示
      placeImage: (place.photos && place.photos.length) ? place.photos[0].url : ''
    };

    getAIRecommendation(requestData)
      .then(res => {
        // 最终数据混合：AI文案 + 高德的真实信息
        const finalResult = {
          ...res,
          location: place.name, // 强制用真名
          address: place.address,
          imageUrl: requestData.placeImage || '' // 优先用高德图
        };

        // 延迟一点显示成功，保证动画播了一会儿
        setTimeout(() => {
          this.handleSuccess(finalResult);
        }, 1500);
      })
      .catch(err => {
        console.error(err);
        this.addLog({ type: 'error', text: 'AI 脑路堵塞，重试中...' });
        this.setData({ spinning: false, isFlowing: false });
      });
  },

  // --- 视觉：模拟分析日志 (简化版，配合真实逻辑) ---
  startAnalysisSimulation(data) {
    // 初始几条固定的氛围日志
    const initialLogs = [
      { type: 'init', text: `正在读取 ${data.relation} 关系模型...` },
      { type: 'weather', text: `加载天气数据：${data.weatherContext}...` },
    ];
    
    // 快速一次性推入，后续的日志由 executeNextStrategy 里的 addLog 触发
    this.setData({ analysisLogs: initialLogs });
  },

  // 辅助：添加单条日志
  addLog(logItem) {
    const logs = this.data.analysisLogs;
    logs.push(logItem);
    this.setData({ 
      analysisLogs: logs,
      scrollTop: logs.length * 100 
    });
    wx.vibrateShort({ type: 'light' });
  },

  // --- 成功结算 ---
  handleSuccess(res) {
    const winIcon = '❤️';
    const winningReel = [ICONS[0], winIcon, ...ICONS]; 

    this.setData({
      reel1: winningReel, reel2: winningReel, reel3: winningReel,
      spinning: false
    });
    
    setTimeout(() => { this.setData({ isFlowing: false }); }, 2500);

    // 震动反馈
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
    }, 2800); 
  },

  // --- 交互：不满意，重抽 ---
  reRoll() {
    // 关键：索引 + 1，这样下次拉杆就会搜队列里的下一个词
    this.setData({ 
      currentIndex: this.data.currentIndex + 1,
      // 重置结果页显示
      showReceipt: false,
      isLoading: true
    });
    
    // 重新拉杆 -> 触发 startSlotProcess -> 触发 executeNextStrategy
    this.pullLever();
  },

  // 辅助函数
  shuffle(arr) { return arr.sort(() => 0.5 - Math.random()); },
  getRandom(arr, n) { return this.shuffle([...arr]).slice(0, n); },
  onImageLoad() { this.setData({ imageLoaded: true }); },
});