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
      this.addLog({ type: 'error', text: '脑洞耗尽，重置灵感库...' });
      this.setData({ currentIndex: 0 });
      this.executeNextStrategy();
      return;
    }

    const keyword = keywordQueue[currentIndex];
    this.addLog({ type: 'search', text: `🛰️ 正在探测周边的 [${keyword}]...` });

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const userLoc = `${res.longitude},${res.latitude}`;
        
        locationService.searchNearby(keyword, userLoc).then(pois => {
          // ✨✨✨ 3.0 核心：类型白名单过滤器 ✨✨✨
          
          const validPois = pois.filter(place => {
            // 传入单个地点进行严格政审
            return this.isValidDateSpot(place, keyword);
          });

          if (validPois.length > 0) {
            // ✅ 搜到了！且类型是正确的吃喝玩乐场所
            // 优先取评分高的，或者离得近的(高德默认排序)
            const bestPlace = validPois[0]; 
            this.addLog({ type: 'found', text: `✅ 锁定优质地点：${bestPlace.name}` });
            
            this.callAiToDecorate(bestPlace, keyword);
          } else {
            // ❌ 搜到了地点，但全是工业园/小区/公司，判定为“无结果”
            console.warn(`[类型过滤] 附近的 ${keyword} 都不适合约会，切换...`);
            this.addLog({ type: 'skip', text: `附近的 ${keyword} 不太好玩，换个地方...` });
            
            // 自动跳下一个词
            this.setData({ currentIndex: currentIndex + 1 });
            this.executeNextStrategy(); 
          }
        });
      },
      fail: () => { /* 定位失败逻辑 */ }
    });
  },

  isValidDateSpot(place, searchKeyword) {
    const name = (place.name || '').toLowerCase(); // 转小写，防漏
    const type = (place.type || '').toLowerCase();
    
    // ===========================================
    // 1. ⛔️ 绝对黑名单 (一票否决)
    // ===========================================
    const blackList = [
      '银行', 'atm', '营业厅', '中介', '房产', '链家', '我爱我家',
      '公司', '物流', '工厂', '园区', '厂', '工地', 
      '幼儿园', '小学', '中学', '培训', '学校', '驾校',
      '派出所', '政府', '委员会', '办事处', '社区', '党群',
      '公厕', '垃圾', '加水', '维修', '停车场', '收费站',
      // 品牌黑名单 (根据你的偏好调整)
      '沙县', '拉面', '瑞幸', 'luckin', '蜜雪冰城', '全家', '7-eleven'
    ];
    
    // 如果命中黑名单，直接 false
    if (blackList.some(bad => name.includes(bad) || type.includes(bad))) {
      console.log(`[政审] 命中黑名单淘汰: ${name}`);
      return false;
    }

    // ===========================================
    // 2. 🎯 特殊词强校验 (只有这些词需要死抠字眼)
    // ===========================================
    // 逻辑：有些词太容易搜偏，必须强制检查名字
    const strictMap = {
      '猫咖': ['猫', '咪', '宠', '喵'],
      '狗咖': ['狗', '汪', '宠', '柴犬', '柯基'],
      '滑雪': ['滑雪', '雪场'],
      '温泉': ['温泉', '汤泉', '泡汤', '洗浴'],
      '书店': ['书', '阅读', '文创'], // 防止搜书店出来文具店
      '电玩': ['电玩', '游戏', '机厅']
    };

    if (strictMap[searchKeyword]) {
      const requiredWords = strictMap[searchKeyword];
      const hasStrictMatch = requiredWords.some(w => name.includes(w) || type.includes(w));
      
      if (!hasStrictMatch) {
        console.log(`[政审] 强校验失败: 搜[${searchKeyword}]但结果[${name}]无相关字`);
        return false;
      }
      // 如果通过了强校验，直接通过，不用看白名单了
      return true;
    }

    // ===========================================
    // 3. 🏳️ 白名单放行 (核心修改：信任高德)
    // ===========================================
    // 逻辑：只要不是黑名单，且属于“玩乐分类”，哪怕名字跟关键词对不上，也放行！
    // 比如：搜"DIY"，高德返回"陶艺馆"。虽然名字没DIY，但陶艺馆在白名单里，放行！
    
    const whiteListCategories = [
      // 核心约会类
      '餐饮', '冷饮', '咖啡', '茶楼', '酒吧', '甜品', 
      '休闲', '娱乐', '影院', 'ktv', '剧院', '游乐', '度假', '农家',
      // 景点类
      '风景', '公园', '植物园', '动物园', '水族馆', '广场', '古镇', '观光',
      // 文化类
      '科教', '博物馆', '美术馆', '图书馆', '展览', '文化', '艺术',
      // 运动类
      '体育', '健身', '球馆', '滑雪', '溜冰', '游泳', '射箭', '瑜伽',
      // 购物类
      '购物', '商场', '步行街', '书店', '花鸟', '市集'
    ];

    const isWhiteListed = whiteListCategories.some(cat => type.includes(cat));
    
    // 只有当它连白名单都不沾边时，才再次检查名字是否包含关键词
    // (兜底逻辑：万一高德分类标错了，但名字对上了，也算过)
    const isNameMatch = name.includes(searchKeyword.toLowerCase());

    if (isWhiteListed || isNameMatch) {
      return true;
    } else {
      console.log(`[政审] 类型不符淘汰: 搜[${searchKeyword}] 结果[${name}] 类型[${type}]`);
      return false;
    }
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