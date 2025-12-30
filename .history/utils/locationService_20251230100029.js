// utils/locationService.js
// ⚠️ 必须填入你的【Web服务】Key (不是小程序Key)
const AMAP_KEY = 'f203aa448fe4f1ebda0a2d52babdaeaf'; 

// 🛡️ 队列系统
let requestQueue = [];
let isProcessing = false;
const MIN_INTERVAL = 600; 

function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;
  const { resolve, params } = requestQueue.shift();

  // 1. 先获取城市编码 (ReGeo)
  getCityCode(params.location).then(cityCode => {
      console.log(`[Location] 📍 定位城市: ${cityCode || '全国'}`);
      
      // 2. 发起全城搜索 (Text Search)
      // 优势：默认按权重(热度)排序，不再傻傻按距离排
      wx.request({
        url: 'https://restapi.amap.com/v3/place/text',
        method: 'GET',
        data: {
          key: AMAP_KEY,
          types: params.types,       // 搜索类型
          city: cityCode,            // 限制在当前城市
          location: params.location, // 传经纬度是为了计算距离(distance)，不是为了排序
          offset: 25,                // 一页25个
          extensions: 'all',         // 获取评分/价格
          children: 1                // 包含子地点
        },
        success: (res) => {
          if (res.data && res.data.status === '1' && res.data.pois) {
            const pois = res.data.pois.map(p => ({
              ...p,
              typecode: p.typecode || '',
              biz_ext: p.biz_ext || {} 
            }));
            resolve({ poisData: pois });
          } else {
            console.warn("API返回空:", res.data);
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
  });
}

// 辅助：获取城市Adcode (如南京=320100)
function getCityCode(location) {
    return new Promise((resolve) => {
        wx.request({
            url: 'https://restapi.amap.com/v3/geocode/regeo',
            method: 'GET',
            data: { key: AMAP_KEY, location: location, extensions: 'base' },
            success: (res) => {
                if (res.data && res.data.status === '1') {
                    // 返回 adcode (行政区划代码)
                    resolve(res.data.regeocode.addressComponent.adcode);
                } else {
                    resolve(''); // 失败则不限城市
                }
            },
            fail: () => resolve('')
        });
    });
}

function scheduleNext() {
  setTimeout(() => { isProcessing = false; processQueue(); }, MIN_INTERVAL);
}

/**
 * 📍 V6.7 全城热度搜索 (解决"只推周围"痛点)
 */
function searchByType(typeCodes, location) {
  return new Promise((resolve) => {
    console.log(`[Location] 🎯 发起全城热搜: Types=[${typeCodes}]`);
    requestQueue.push({ resolve, params: { types: typeCodes, location } });
    processQueue();
  });
}

module.exports = { searchByType };