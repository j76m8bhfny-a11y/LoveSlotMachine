// utils/locationService.js
const amapFile = require('./amap-wx.js');
const AMAP_KEY = 'f203aa448fe4f1ebda0a2d52babdaeaf'; 
const myAmapFun = new amapFile.AMapWX({ key: AMAP_KEY });

// ==========================================
// 1. 🧬 基因锁：关键词 + 强制分类代码
// ==========================================
// 高德分类编码 (Type Code) 参考：
// 110000: 风景名胜 (景区, 公园)
// 080000: 体育休闲 (运动, 娱乐)
// 140000: 科教文化 (博物馆, 美术馆)
// 060000: 购物服务 (商场)
// ❌ 050000: 餐饮服务 (彻底屏蔽！)
const SEARCH_STRATEGY = {
  // ⛰️ 户外/自然
  '爬山': { q: '山|景区|森林公园|自然保护区', types: '110000|110100|110200' },
  '寺庙': { q: '寺庙|道观|古寺', types: '110000' },
  '露营': { q: '露营|营地|郊野', types: '110000|110100' },
  '野餐': { q: '草坪|公园|植物园', types: '110000|110100' },
  
  // 🏂 运动/体育
  '滑雪': { q: '滑雪场|冰雪世界', types: '080000' }, // 080000=体育休闲服务
  '溜冰': { q: '滑冰|溜冰', types: '080000' },
  '游泳': { q: '游泳', types: '080000' },
  '射箭': { q: '射箭', types: '080000' },
  '骑行': { q: '绿道|公园', types: '110000|080000' },

  // 🎨 室内体验
  '看展': { q: '美术馆|艺术中心|展览|博物馆', types: '140000|140100' },
  '书店': { q: '书店|图书馆|书局', types: '140000|130400' },
  'DIY':  { q: '陶艺|手工|画室|DIY', types: '080000|140000|060000' }, // 06是购物，有些DIY店在商场里
  '猫咖': { q: '猫咖|猫咪', types: '080000|060000' }, 
  '私影': { q: '私人影院|影吧', types: '080000' },
  '密室': { q: '密室|剧本杀', types: '080000' },
  '电玩': { q: '电玩城|游戏厅', types: '080000' },
  
  // 🛁 休闲
  '洗浴': { q: '洗浴|汤泉|汗蒸', types: '080000' },
  '温泉': { q: '温泉', types: '080000|110000' }
};

// ==========================================
// 2. 🛡️ 队列系统 (防 10021 限流)
// ==========================================
let requestQueue = [];
let isProcessing = false;
const MIN_INTERVAL = 600; // 安全间隔

function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;
  const { resolve, params } = requestQueue.shift();

  myAmapFun.getPoiAround({
    ...params,
    success: (data) => { 
      resolve(data); 
      scheduleNext(); 
    },
    fail: (info) => { 
      // 即使API报错，也resolve空数组，防止外层Promise.all挂掉
      console.warn("高德API异常:", info);
      resolve({ poisData: [] }); 
      scheduleNext(); 
    }
  });
}

function scheduleNext() {
  setTimeout(() => { isProcessing = false; processQueue(); }, MIN_INTERVAL);
}

// ==========================================
// 3. 对外接口
// ==========================================
function searchNearby(keyword, location) {
  return new Promise((resolve) => {
    // 1. 获取策略
    const strategy = SEARCH_STRATEGY[keyword];
    
    // 默认兜底：如果没有定义严格策略，就搜“玩乐”，且只允许 科教/体育/风景
    const queryKeywords = strategy ? strategy.q : `${keyword}|玩乐`;
    const queryTypes = strategy ? strategy.types : '080000|110000|140000'; 

    console.log(`[Location] 搜:[${keyword}] -> 词:[${queryKeywords}] 类型限制:[${queryTypes}]`);

    // 2. 构造参数
    const params = {
      query_keywords: queryKeywords,
      query_types: queryTypes, // 👈 关键：API级别的类型过滤
      location: location,
      radius: 50000,   
      sortrule: 'weight', 
      offset: 25,     
      extensions: 'all'
    };

    // 3. 入队
    requestQueue.push({ resolve, params });
    processQueue();
  });
}

module.exports = { searchNearby };