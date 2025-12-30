// utils/locationService.js
const amapFile = require('./amap-wx.js');
const AMAP_KEY = 'f203aa448fe4f1ebda0a2d52babdaeaf'; // ⚠️ 确认 Key 没变
const myAmapFun = new amapFile.AMapWX({ key: AMAP_KEY });

// 映射表保持不变 (风景名胜|森林公园...)
const SEARCH_MAPPING = {
  '爬山': '风景名胜|森林公园|山峰|自然保护区',
  '滑雪': '滑雪场|冰雪世界',
  '溜冰': '滑冰场|溜冰场',
  '游泳': '游泳馆|恒温泳池|水上乐园',
  '射箭': '射箭馆|射箭俱乐部',
  '骑行': '绿道|公园|湖畔',
  '露营': '露营地|房车营地|郊野公园',
  '野餐': '植物园|湿地公园|草坪|公园广场',
  'DIY': '陶艺|手工坊|画室|DIY|烘焙', 
  '猫咖': '猫咖|猫咪|宠物咖啡',
  '狗咖': '狗咖|宠物店',
  '私影': '私人影院|影吧|点播影院',
  '密室': '密室逃脱|实景娱乐',
  '剧本杀': '剧本杀|桌游',
  '电玩': '电玩城|游戏厅',
  '洗浴': '洗浴中心|汤泉|汗蒸|水疗',
  '温泉': '温泉度假|泡汤',
  '看展': '美术馆|艺术中心|展览馆|博物馆',
  '书店': '书店|图书馆|书局|文化宫',
  '寺庙': '寺庙|道观|古寺'
};

// ==========================================
// 🛡️ 稳健的请求队列 (防死锁版)
// ==========================================
let requestQueue = [];
let isProcessing = false;
const MIN_INTERVAL = 600; 

function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  
  isProcessing = true;
  const { resolve, params } = requestQueue.shift();

  try {
    myAmapFun.getPoiAround({
      ...params,
      success: (data) => {
        resolve(data);
        scheduleNext();
      },
      fail: (info) => {
        console.warn("⚠️ 高德API报错:", info);
        // 即使报错也 resolve 一个空数据，防止 Promise.all 卡死
        resolve({ poisData: [] }); 
        scheduleNext();
      }
    });
  } catch (e) {
    console.error("🔥 SDK调用异常:", e);
    resolve({ poisData: [] });
    scheduleNext();
  }
}

function scheduleNext() {
  setTimeout(() => {
    isProcessing = false;
    processQueue(); // 递归处理下一个
  }, MIN_INTERVAL);
}

// 外部接口
function searchNearby(keyword, location) {
  return new Promise((resolve) => {
    // 1. 映射逻辑
    const realQuery = SEARCH_MAPPING[keyword] || `${keyword}|玩乐|休闲`; 
    console.log(`[Location] 搜:${keyword} -> 高德:${realQuery}`);

    // 2. 构造参数
    const params = {
      query_keywords: realQuery,
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