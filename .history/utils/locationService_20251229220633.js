// utils/locationService.js
const amapFile = require('./amap-wx.js');
// ⚠️ 记得确认你的 Key 是否有效
const AMAP_KEY = 'f203aa448fe4f1ebda0a2d52babdaeaf'; 
const myAmapFun = new amapFile.AMapWX({ key: AMAP_KEY });

// 🛡️ 队列系统 (防并发限流，保持稳健)
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
 * 📍 V6.0 核心搜索：按类型编码搜索 (精准版)
 * @param {String} typeCodes - 高德分类编码，如 "110100|140100"
 * @param {String} location - 经纬度 "long,lat"
 */
function searchByType(typeCodes, location) {
  return new Promise((resolve) => {
    
    console.log(`[Location] 🎯 发起精准搜索: Types=[${typeCodes}]`);

    const params = {
      // ⚠️⚠️⚠️ 核心修正：对应 amap-wx.js 的参数名，千万别加下划线！ ⚠️⚠️⚠️
      querytypes: typeCodes, 
      
      location: location,
      
      // 你的定制需求：50公里超大范围
      radius: 50000,      
      
      // 你的定制需求：按权重排序 (优先找大IP，而不是最近的小卖部)
      sortrule: 'weight', 
      
      offset: 25,         // 一次拿25个结果
      extensions: 'all'   // 🔥 必须开！否则拿不到评分和人均消费
    };

    // 入队执行
    requestQueue.push({ resolve, params });
    processQueue();
  });
}

module.exports = { searchByType };