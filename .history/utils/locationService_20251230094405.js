// utils/locationService.js

// ⚠️ 填入你的高德 Key
const AMAP_KEY = 'f203aa448fe4f1ebda0a2d52babdaeaf'; 

// 🛡️ 队列系统 (保持防并发限流)
let requestQueue = [];
let isProcessing = false;
const MIN_INTERVAL = 600; 

function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;
  const { resolve, params } = requestQueue.shift();

  // 🔥🔥🔥 核心修改：踢开 amap-wx.js，直接用 wx.request 发起请求 🔥🔥🔥
  wx.request({
    url: 'https://restapi.amap.com/v3/place/around',
    method: 'GET',
    data: {
      key: AMAP_KEY,
      location: params.location,
      types: params.types,       // 对应 API 的 types 参数
      radius: params.radius,     // ✅ 终于生效了：50000米
      sortrule: params.sortrule, // ✅ 终于生效了：weight (权重优先)
      offset: params.offset,     // ✅ 终于生效了：一次拿25个
      extensions: 'all',         // ✅ 终于生效了：获取详细信息(评分/价格)
      citylimit: 'true'          // 建议加上：只返回同城结果，防止漂到外地
    },
    success: (res) => {
      if (res.data && res.data.status === '1' && res.data.pois) {
        // 格式化一下数据，保持跟之前兼容
        const pois = res.data.pois.map(p => ({
          ...p,
          // 确保 typecode 存在
          typecode: p.typecode || '',
          // 确保 biz_ext 存在
          biz_ext: p.biz_ext || {} 
        }));
        resolve({ poisData: pois });
      } else {
        // 搜不到或者出错
        console.warn("高德API返回空或错误:", res.data);
        resolve({ poisData: [] });
      }
      scheduleNext();
    },
    fail: (err) => {
      console.error("网络请求失败:", err);
      resolve({ poisData: [] });
      scheduleNext();
    }
  });
}

function scheduleNext() {
  setTimeout(() => { isProcessing = false; processQueue(); }, MIN_INTERVAL);
}

/**
 * 📍 V6.6 核心搜索：原生请求版 (彻底解决距离限制)
 * @param {String} typeCodes - 高德分类编码
 * @param {String} location - 经纬度 "long,lat"
 */
function searchByType(typeCodes, location) {
  return new Promise((resolve) => {
    
    console.log(`[Location] 🎯 发起直连搜索: Types=[${typeCodes}]`);

    const params = {
      types: typeCodes,   // 注意：这里我们直接用 API 原生参数名 types，不再用 querytypes
      location: location,
      radius: 50000,      // 50公里，这次是真的了！
      sortrule: 'weight', // 权重优先，不再是距离优先
      offset: 25
    };

    // 入队执行
    requestQueue.push({ resolve, params });
    processQueue();
  });
}

module.exports = { searchByType };