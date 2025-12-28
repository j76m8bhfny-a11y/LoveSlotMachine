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
    const { budget, weatherContext } = data;
    // data.weatherContext 格式示例: "中雨, 28°C" 或 "晴, 35"

    // --- A. 环境判断 (升级版) ---
    
    // 1. 判断是否下雨/恶劣天气 (保持原逻辑)
    // 加上 || '' 是防止 weatherContext 为空时报错
    const isPrecipitation = /雨|雪|暴|沙|霾/.test(weatherContext || '');

    // 2. 提取温度数值 (新增逻辑)
    let temp = 25; // 给一个默认的舒适温度作为兜底
    // 使用正则 /(-?\d+)/ 提取字符串里的第一个数字 (支持负数)
    const tempMatch = (weatherContext || '').match(/(-?\d+)/);
    if (tempMatch) {
      temp = parseInt(tempMatch[0]);
    }

    // 3. 综合决策
    // 规则：下雨 OR 太热(>32°) OR 太冷(<5°) -> 统统赶去室内
    const isBadWeather = isPrecipitation || temp > 32 || temp < 5;
    
    const envKey = isBadWeather ? 'indoor' : 'outdoor';

    // 打印日志方便调试，看看它到底判对了没
    console.log(`[策略引擎] 原文:${weatherContext} => 提取温度:${temp}° => 判定环境:${envKey}`);


    // --- B. 预算判断 (保持不变) ---
    let budgetKey = 'low';
    const b = parseInt(budget);
    if (b >= 100 && b < 300) budgetKey = 'medium';
    if (b >= 300) budgetKey = 'high';

    // --- C. 取词 + 混入 (保持不变) ---
    // ⚠️ 注意：要确保 KEYWORD_POOLS 已经引入
    let pool = [...KEYWORD_POOLS[envKey][budgetKey]];
    
    // 增加一点惊喜：混入少量低价好去处
    if (budgetKey !== 'low') {
      pool = pool.concat(this.getRandom(KEYWORD_POOLS[envKey]['low'], 3));
    }

    // D. 洗牌并保存
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
    const name = place.name || '';
    const type = place.type || ''; // 高德返回的分类字符串，如 "餐饮服务;咖啡厅"
    const address = place.address || '';

    // 1. ⛔️ 绝对黑名单 (优先级最高，秒拒)
    // 包含这些字眼的，不管 type 是啥，绝对不行
    const blackList = ['银行', 'ATM', '营业厅', '中介', '房产', '公司', '物流', '厂', '幼儿园', '小学', '中学', '培训', '加水', '公厕', '垃圾', '派出所', '政府', '委员会', '办事处'];
    if (blackList.some(bad => name.includes(bad) || type.includes(bad))) {
      return false;
    }

    // 2. ✅ 类型白名单 (必须命中其中之一)
    // 只有 type 包含这些关键词，才认为是“玩乐/约会”属性
    const whiteListCategories = [
      // 吃喝
      '餐饮', '冷饮', '咖啡', '茶楼', '酒吧', '甜品', 
      // 玩乐
      '休闲', '娱乐', '影院', 'KTV', '剧院', '歌舞', '游乐', '度假', '农家', 
      // 景点
      '风景', '公园', '植物园', '动物园', '水族馆', '广场', '古镇', '观光', 
      // 文化
      '科教文化', '博物馆', '美术馆', '图书馆', '展览', '文化宫', 
      // 运动
      '体育', '健身', '球馆', '滑雪', '溜冰', '游泳',
      // 购物
      '购物', '商场', '步行街', '书店', '花鸟'
    ];

    const isWhiteListed = whiteListCategories.some(cat => type.includes(cat));

    // 3. 🛡️ 兜底逻辑：如果搜的是具体的词（比如"书店"），但高德有时候 type 标得不准
    // 我们允许名字里直接包含搜索关键词的情况
    // 比如搜“猫咖”，type 可能是“餐饮”，但名字叫“喵喵猫咖”，这也算对
    const isNameMatch = name.includes(searchKeyword);

    // 结论：(不在黑名单) AND (在白名单 OR 名字对得上)
    return isWhiteListed || isNameMatch;
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