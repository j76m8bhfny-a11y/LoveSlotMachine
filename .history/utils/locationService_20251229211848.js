// utils/locationService.js
const amapFile = require('./amap-wx.js');
// ⚠️ 记得确认你的 Key 是否有效
const AMAP_KEY = 'f203aa448fe4f1ebda0a2d52babdaeaf'; 
const myAmapFun = new amapFile.AMapWX({ key: AMAP_KEY });

// 🛡️ 队列系统 (防并发限流)
let requestQueue = [];
let isProcessing = false;
const MIN_INTERVAL = 600; 

function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;
  const { resolve, params } = requestQueue.shift();

  myAmapFun.getPoiAround({
    ...params,
    success: (data) => { resolve(data); scheduleNext(); },
    fail: (info) => { 
        console.warn("API Error:", info);
        resolve({ poisData: [] }); 
        scheduleNext(); 
    }
  });
}

function scheduleNext() {
  setTimeout(() => { isProcessing = false; processQueue(); }, MIN_INTERVAL);
}

/**
 * 📍 V6.0 核心搜索：按类型编码搜索
 * @param {String} typeCodes - 高德分类编码，如 "110100|140100"
 * @param {String} location - 经纬度 "long,lat"
 */
function searchByType(typeCodes, location) {
  return new Promise((resolve) => {
    
    console.log(`[Location] 🎯 精准打击: Types=[${typeCodes}]`);

    const params = {
      // ⚠️ 核心改变：不再用 query_keywords，只用 query_types
      query_types: typeCodes, 
      location: location,
      radius: 30000,      // 30公里范围
      sortrule: 'weight', // 按权重排序
      offset: 25,         // 一次拿25个结果用来选妃
      extensions: 'all'   // 🔥 必须开！否则拿不到评分和人均消费
    };

    requestQueue.push({ resolve, params });
    processQueue();
  });
}

module.exports = { searchByType };