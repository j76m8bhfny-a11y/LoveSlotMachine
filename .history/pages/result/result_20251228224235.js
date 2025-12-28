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

    console.log(`[调试] 当前要搜的词是: "${keyword}" (类型: ${typeof keyword})`);


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
            // 1. 打印失败原因
            const reason = pois.length > 0 ? "不符合纯玩标准" : "方圆50里都没有";
            console.warn(`[跳过] ${keyword}: ${reason}`);
            this.addLog({ type: 'skip', text: `[${keyword}] ${reason}，正在思考新方案...` });
            
            // 2. 指针下移
            this.setData({ currentIndex: currentIndex + 1 });

            // ✨✨✨ 关键修改：强制冷却 1.2 秒 ✨✨✨
            // 高德免费版通常限制 QPS < 3，甚至更低。
            // 加上这个 setTimeout，就算所有词都失败，也不会报错 10021。
            setTimeout(() => {
              this.executeNextStrategy();
            }, 1200); 
          }
        }).catch(err => {
            console.error('高德API异常:', err);
            
            // ⚠️ 如果真的是 10021，说明还是太快了，这里我们要多歇会儿
            let delay = 1200;
            if (err && err.errCode === '10021') {
                console.warn('触发限流，进入深度冷却...');
                this.addLog({ type: 'error', text: '大脑过载，休息一下...' });
                delay = 3000; // 休息3秒再试
            }

            this.setData({ currentIndex: currentIndex + 1 });
            setTimeout(() => this.executeNextStrategy(), delay);
        });
      },
      fail: () => { /* ... */ }
    });
  },

  // ✨✨✨ 终极纯净版：所见即所得 (WYSIWYG) ✨✨✨
  isValidDateSpot(place, searchKeyword) {
    // 1. 数据清洗：全部转小写，防止大小写差异导致匹配失败
    const name = (place.name || '').toLowerCase();
    const type = (place.type || '').toLowerCase();
    const k = (searchKeyword || '').toLowerCase();

    // ===========================================
    // 1. ⛔️ 绝对黑名单 (维持原判，脏东西坚决不要)
    // ===========================================
    const blackList = [
      '银行', 'atm', '营业厅', '中介', '房产', '公司', '物流', '厂', '园区',
      '学校', '培训', '驾校', '派出所', '政府', '委员会', '办事处', 
      '公厕', '垃圾', '停车场', '收费站', '加油站', '加水', '维修',
      // 品牌黑名单 (拒绝快餐式约会)
      '沙县', '拉面', '瑞幸', 'luckin', '蜜雪冰城', '全家', '7-eleven', '肯德基', '麦当劳'
    ];
    
    if (blackList.some(bad => name.includes(bad) || type.includes(bad))) {
      console.log(`[淘汰] 命中黑名单: ${name}`);
      return false;
    }

    // ===========================================
    // 2. 🎯 词义映射 (解决“搜A出B”的合理情况)
    // ===========================================
    // 这一步是为了防止“过于严格”。
    // 比如：搜“爬山”，高德返回“XX风景区”或“XX森林公园”。
    // 名字里没“爬山”二字，但它是对的。如果不做映射，会被误杀。
    const keywordMapping = {
      // 运动类
      '爬山': ['山', '峰', '景区', '森林', '徒步', '绿道'],
      '滑雪': ['滑雪', '雪场'],
      '溜冰': ['溜冰', '滑冰', '冰上'],
      '游泳': ['游泳', '水上'],
      '射箭': ['射箭', '弓箭'],
      
      // 体验类
      'diy': ['陶艺', '手工', '画室', '手作', '烘焙', '戒指'],
      '猫咖': ['猫', '咪', '宠', '喵'],
      '狗咖': ['狗', '汪', '宠'],
      '电玩': ['电玩', '游戏', '机厅'],
      '密室': ['密室', '逃脱'],
      '剧本杀': ['剧本', '侦探'],
      
      // 休闲类
      '温泉': ['温泉', '汤泉', '泡汤', '洗浴'],
      '洗浴': ['洗浴', '汗蒸', '桑拿', '足疗', '按摩'],
      '私影': ['私人影院', '影吧', '视听'],
      '露营': ['露营', '营地', '帐篷'],
      '野餐': ['公园', '草坪', '绿地']
    };

    // 如果搜索词在映射表里，检查结果是否包含相关词汇
    if (keywordMapping[k]) {
      const relatedWords = keywordMapping[k];
      // 只要名字 OR 类型里 包含任意一个相关词，就通过
      const isMatch = relatedWords.some(w => name.includes(w) || type.includes(w));
      
      if (isMatch) {
        return true; // ✅ 匹配成功
      } else {
        console.log(`[淘汰] 强校验不符: 搜[${k}] 结果[${name}]`);
        return false; // ❌ 搜爬山给了汤泉 -> 滚
      }
    }

    // ===========================================
    // 3. 🔍 原始精准匹配 (没有保底了！)
    // ===========================================
    // 如果不在映射表里（比如搜“公园”、“动物园”、“KTV”这种标准词）
    // 逻辑：名字里必须有这个词，或者分类里明确写了是这个类型。
    // 绝不因为它是“好玩的地方”就放行。

    const nameHasIt = name.includes(k);
    const typeHasIt = type.includes(k);

    if (nameHasIt || typeHasIt) {
      return true;
    }

    // 💀 到了这里说明：既没过映射，名字和类型也不含关键词。
    // 比如：搜“海边”，结果“海鲜大排档” (假设黑名单没拦住，这里也会拦住，因为类型不对)
    // 比如：搜“爬山”，结果“汤山洗浴” (名字含山，但如果有映射表会优先走映射表被拦；如果没有映射表，这里可能会误过，但我们在第2步已经处理了爬山)
    
    console.log(`[淘汰] 精准匹配失败: 搜[${k}] 结果[${name}] 类型[${type}]`);
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