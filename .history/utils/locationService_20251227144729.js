// utils/locationService.js
// ⚠️ 确保 amap-wx.js 已经在 utils 目录下
const amapFile = require('./amap-wx.js');

// ⚠️ 填入你的高德 Key
const AMAP_KEY = 'f203aa448fe4f1ebda0a2d52babdaeaf'; 

const myAmapFun = new amapFile.AMapWX({ key: AMAP_KEY });

/**
 * 搜索周边 (超大范围版)
 * @param {string} keyword - 搜索关键词
 * @param {string} location - "经度,纬度"
 */
function searchNearby(keyword, location) {
  return new Promise((resolve, reject) => {
    myAmapFun.getPoiAround({
      query_keywords: keyword,
      location: location,
      
      // ✨✨✨ 关键修改 1：扩大搜索半径 ✨✨✨
      // 50000米 = 50公里。
      // 这样你在江宁，也能搜到栖霞区的欢乐谷、浦口的珍珠泉。
      radius: 50000, 

      // ✨✨✨ 关键修改 2：按权重排序 ✨✨✨
      // 'weight' = 优先返回知名度高、评分高的地方 (比如真正的欢乐谷)
      // 'distance' = 优先返回近的 (可能会搜到叫"欢乐谷"的小卖部)
      sortrule: 'weight', 
      
      offset: 20, // 一次取20个回来慢慢挑
      
      success: function(data){
        if (data && data.poisData && data.poisData.length > 0) {
          resolve(data.poisData);
        } else {
          // 真的搜不到 (比如在南京搜海边)
          resolve([]); 
        }
      },
      fail: function(info){
        console.error("高德搜索失败:", info);
        // 容错处理：不仅reject，最好也resolve空数组，防止外层Promise.all崩掉
        resolve([]); 
      }
    });
  });
}

module.exports = { searchNearby };