// utils/locationService.js
// ⚠️ 保持你的 Web 服务 Key
const AMAP_KEY = '66482a2e37b234cb4dda27e5997d584d'; 

// 🛡️ 队列系统
let requestQueue = [];
let isProcessing = false;
const MIN_INTERVAL = 300; // 并发了，间隔可以稍微短一点

function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;
  const { resolve, params } = requestQueue.shift();

  // 1. 获取城市代码 (只需要做一次)
  getCityCode(params.location).then(cityCode => {
      console.log(`[Location] 📍 定位城市: ${cityCode || '全国'}`);
      
      // 2. 核心逻辑：拆分 Types，分头行动
      const typeList = params.types.split('|');
      
      // 限制一下，防止一次发太多请求炸了
      // 比如一个包里有 5 个类型，我们不仅要搜，还要限制每个类型搜多少个
      // 策略：每个类型搜 Top 10，足够精品了
      const promises = typeList.map(singleType => {
          return fetchPois(singleType, cityCode, params.location);
      });

      Promise.all(promises).then(results => {
          // results 是一个数组的数组 [[A类店...], [B类店...]]
          // 3. 结果扁平化 + 去重
          let allPois = [];
          const seenIds = new Set();

          results.forEach(list => {
              list.forEach(p => {
                  if (!seenIds.has(p.id)) {
                      seenIds.add(p.id);
                      allPois.push(p);
                  }
              });
          });

          console.log(`[Location] 📦 并发汇总: 搜了 ${typeList.length} 类, 共获 ${allPois.length} 个地点`);
          resolve({ poisData: allPois });
          scheduleNext();

      }).catch(err => {
          console.error("并发搜索失败", err);
          resolve({ poisData: [] });
          scheduleNext();
      });
  });
}

// 📦 单个类型搜索工人
function fetchPois(singleType, cityCode, location) {
    return new Promise((resolve) => {
        wx.request({
            url: 'https://restapi.amap.com/v3/place/text',
            method: 'GET',
            data: {
                key: AMAP_KEY,
                types: singleType,      // 👈 每次只搜这一个类型！
                city: cityCode,
                location: location,
                offset: 15,             // ✅ 每个类型只取前15名 (保证精华)
                extensions: 'all',
                children: 1
            },
            success: (res) => {
                if (res.data && res.data.status === '1' && res.data.pois) {
                    const formatted = res.data.pois.map(p => ({
                        ...p,
                        typecode: p.typecode || '',
                        biz_ext: p.biz_ext || {}
                    }));
                    resolve(formatted);
                } else {
                    resolve([]);
                }
            },
            fail: () => resolve([])
        });
    });
}

// 辅助：获取城市Adcode
function getCityCode(location) {
    return new Promise((resolve) => {
        wx.request({
            url: 'https://restapi.amap.com/v3/geocode/regeo',
            method: 'GET',
            data: { key: AMAP_KEY, location: location, extensions: 'base' },
            success: (res) => {
                if (res.data && res.data.status === '1') {
                    resolve(res.data.regeocode.addressComponent.adcode);
                } else {
                    resolve(''); 
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
 * 📍 V7.0 并发精准搜索
 * 逻辑：你给我 "A|B|C"，我拆成 3 个请求分别搜 A, B, C，保证谁也不会被谁挤掉
 */
function searchByType(typeCodes, location) {
  return new Promise((resolve) => {
    console.log(`[Location] 🎯 准备并发搜索: Types=[${typeCodes}]`);
    requestQueue.push({ resolve, params: { types: typeCodes, location } });
    processQueue();
  });
}

module.exports = { searchByType };