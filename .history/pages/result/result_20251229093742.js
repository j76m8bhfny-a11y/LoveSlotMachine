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
    const { keywordQueue, currentIndex } = this.data;

    // 1. 边界检查
    if (currentIndex >= keywordQueue.length) {
      this.addLog({ type: 'error', text: '搜遍全城也没找到，降低标准重试...' });
      // 💡 策略：如果搜完了还没找到，可以考虑重置 index 或者跳转到一个兜底页
      this.setData({ isLoading: false, showReceipt: true, result: null }); // 显示无结果状态
      return;
    }

    // ✨ 一次取 2 个词 (避免队列太长用户等太久)
    const BATCH_SIZE = 2; 
    const batchKeywords = keywordQueue.slice(currentIndex, currentIndex + BATCH_SIZE);
    
    // 指针后移
    this.setData({ currentIndex: currentIndex + BATCH_SIZE });
    this.addLog({ type: 'search', text: `🛰️ 正在探测: ${batchKeywords.join(' & ')}...` });

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const userLoc = `${res.longitude},${res.latitude}`;
        
        // 🚀 并发调用 (底层会自动排队，不会 10021)
        const promises = batchKeywords.map(k => locationService.searchNearby(k, userLoc));

        Promise.all(promises).then(results => {
          let bestPlace = null;
          let bestKeyword = '';

          // 遍历结果寻找幸存者
          for (let i = 0; i < results.length; i++) {
            const data = results[i];
            const currentKeyword = batchKeywords[i];
            
            if (data && data.poisData && data.poisData.length > 0) {
              // 🔍 过滤逻辑
              const validPois = data.poisData.filter(p => this.isValidDateSpot(p, currentKeyword));
              
              if (validPois.length > 0) {
                bestPlace = validPois[0];
                bestKeyword = currentKeyword;
                break; // 找到了就跳出
              }
            }
          }

          if (bestPlace) {
            // ✅ 成功
            this.addLog({ type: 'found', text: `✅ 发现好去处：${bestPlace.name}` });
            this.callAiToDecorate(bestPlace, bestKeyword);
          } else {
            // ❌ 这一批没找到，立即试下一批 (不需要 setTimeout，因为底层队列已经控制了频率)
            console.warn(`[Batch] ${batchKeywords} 全军覆没，继续...`);
            this.executeNextStrategy();
          }
        }).catch(err => {
          console.error("Batch Error:", err);
          this.executeNextStrategy(); // 出错也继续
        });
      },
      fail: () => {
        this.addLog({ type: 'error', text: '请授权定位，否则无法搜索' });
        this.setData({ spinning: false });
      }
    });
  },

  // ✨✨✨ 终极纯净版：所见即所得 (WYSIWYG) ✨✨✨
  isValidDateSpot(place, searchKeyword) {
    const name = (place.name || '').toLowerCase();
    const type = (place.type || '').toLowerCase(); // 高德分类字符串
    const address = (place.address || '').toLowerCase();

    // ===========================================
    // 1. ⛔️ 必须死黑名单 (精准打击)
    // ===========================================
    // 解决“中国邮政”、“学校”、“派出所”等问题
    const blackList = [
      '银行', 'atm', '营业厅', '中介', '房产', '物流', '快递', '驿站',
      '公司', '厂', '园区', '大厦', '办事处', '委员会', '党群', '居委会',
      '学校', '培训', '驾校', '幼儿园', '小学', '中学', '大学',
      '派出所', '公安', '政府', '法院', '医院', '卫生院', '药房',
      '公厕', '垃圾', '停车场', '收费站', '加油站', '加水', '维修', '汽修',
      '沙县', '拉面', '黄焖鸡', '瑞幸', 'luckin', '蜜雪', '肯德基', '麦当劳'
    ];
    
    // 如果名字 OR 类型 包含黑名单词，直接毙掉
    if (blackList.some(bad => name.includes(bad) || type.includes(bad))) {
      return false; 
    }

    // ===========================================
    // 2. 🛡️ 核心类型保底 (Type Guard)
    // ===========================================
    // 防止“搜爬山”出来“中国邮政”（虽然黑名单已经防了大部分）
    // 我们定义一个“安全类型库”，如果搜特定词，必须包含特定类型
    
    // 只有容易歪楼的词才加这个限制，其他的词（如密室）一般不会歪
    if (searchKeyword.includes('爬山') || searchKeyword.includes('滑雪')) {
      const safeTypes = ['风景', '名胜', '景区', '公园', '度假', '休闲'];
      const isSafeType = safeTypes.some(t => type.includes(t));
      if (!isSafeType) return false;
    }

    // ===========================================
    // 3. ✅ 最终宽松匹配 (解决搜不到)
    // ===========================================
    // 只要不是黑名单，并且：
    // A. 名字里有关键词 (如 "X山X")
    // B. 类型里有关键词 (如 "风景名胜")
    // C. [新] 地址里有关键词 (有些店名字没写，但地址写了)
    
    // 将关键词简化，比如“爬山”只匹配“山”
    const simpleKey = searchKeyword.replace('爬', '').replace('去', ''); 
    
    if (name.includes(simpleKey) || type.includes(simpleKey)) {
      return true;
    }

    // 🚀 [兜底策略] 如果高德分类是“休闲娱乐”或“旅游景点”，且名字不难听，也放行
    // 这样能大幅提高召回率
    if (type.includes('风景') || type.includes('公园') || type.includes('休闲') || type.includes('度假')) {
        return true;
    }

    return false;
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