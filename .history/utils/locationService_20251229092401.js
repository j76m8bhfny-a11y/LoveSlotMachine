// utils/locationService.js
const amapFile = require('./amap-wx.js');
const AMAP_KEY = 'f203aa448fe4f1ebda0a2d52babdaeaf'; 
const myAmapFun = new amapFile.AMapWX({ key: AMAP_KEY });

// 🗺️ 搜索词隐射表：把“动作”翻译成“地点类型”
// 格式：'用户看到的词': '高德搜索的词'
const SEARCH_MAPPING = {
  // 运动类
  '爬山': '风景名胜|森林公园|山',  // 搜这三个词，用 | 分隔
  '滑雪': '滑雪场|冰雪世界',
  '溜冰': '溜冰场|滑冰',
  '游泳': '游泳馆|恒温泳池',
  '射箭': '射箭馆',
  '骑行': '绿道|公园',
  
  // 体验类
  'DIY': '陶艺|手工|画室|DIY', // 加上具体类目
  '猫咖': '猫咖|猫咪咖啡',
  '私影': '私人影院|影吧',
  '密室': '密室逃脱',
  '剧本杀': '剧本杀',
  
  // 氛围类
  '野餐': '草坪|公园|植物园',
  '露营': '露营地|房车营地',
  '看展': '美术馆|艺术中心|展览',
  '寺庙': '寺庙|道观'
};

/**
 * 搜索周边 (智能映射版)
 */
function searchNearby(keyword, location) {
  return new Promise((resolve, reject) => {
    // 1. 🔍 查字典：如果有对应的专业搜索词，就用专业的；否则用原词
    // 比如用户搜 "爬山"，实际发给高德的是 "风景名胜|森林公园|山"
    const realQuery = SEARCH_MAPPING[keyword] || keyword;

    console.log(`[Location] 用户搜:${keyword} -> 实际搜:${realQuery}`);

    myAmapFun.getPoiAround({
      query_keywords: realQuery, 
      location: location,
      radius: 50000, 
      sortrule: 'weight', 
      offset: 20, 
      
      success: function(data){
        if (data && data.poisData && data.poisData.length > 0) {
          resolve(data.poisData);
        } else {
          resolve([]); 
        }
      },
      fail: function(info){
        // 只有真正的网络错误才打印 error，搜不到不算错
        if (info.errMsg !== 'request:ok') {
          console.error("高德异常:", info);
        }
        resolve([]); 
      }
    });
  });
}

module.exports = { searchNearby };