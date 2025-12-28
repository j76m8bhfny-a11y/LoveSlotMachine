// utils/locationService.js
// ⚠️ 确保 amap-wx.js 已经在 utils 目录下
const amapFile = require('./amap-wx.js');

// ⚠️ 填入你的高德 Key
const AMAP_KEY = '你的高德小程序Key'; 

const myAmapFun = new amapFile.AMapWX({ key: AMAP_KEY });

/**
 * 搜索周边的 POI
 * @param {string} keyword - 搜索关键词 (如 "猫咖")
 * @param {string} location - "经度,纬度" (如 "116.48,39.99")
 */
function searchNearby(keyword, location) {
  return new Promise((resolve, reject) => {
    myAmapFun.getPoiAround({
      query_keywords: keyword,
      location: location, // 传入用户的经纬度
      sortrule: 'weight', // 按权重排序 (优先热门/评分高)
      offset: 10,         // 取前10个备选
      success: function(data){
        if (data && data.poisData && data.poisData.length > 0) {
          resolve(data.poisData);
        } else {
          resolve([]); // 没搜到，返回空数组
        }
      },
      fail: function(info){
        console.error("高德搜索失败:", info);
        resolve([]); // 失败也返回空，防止程序崩溃
      }
    });
  });
}

module.exports = { searchNearby };