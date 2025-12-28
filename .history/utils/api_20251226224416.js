// utils/api.js
const API_KEY = "sk-qdgojmqmlzzqnxknlxxdcrkzmxsxynsncvxtantphkryzsjl"; // ⚠️ 注意保护 Key
const API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL_ID = "deepseek-ai/DeepSeek-V3"; // 既然是V3就填V3

// ✨✨ 构造 Prompt：接收真实地点，专注于“吹彩虹屁” ✨✨
const generatePrompt = (data) => {
  // 1. 解构出 result.js 传来的参数
  // 注意：这里新增了 realPlaceName 等参数
  const { 
    relation, 
    weatherContext, 
    realPlaceName, 
    realPlaceAddress, 
    keywordCategory,
    date 
  } = data; 
  
  // 保留你原本的很棒的随机风格逻辑
  const vibes = ["神秘小众", "疯狂刺激", "极致慵懒", "复古怀旧", "赛博朋克", "自然野趣", "文艺清新"];
  const randomVibe = vibes[Math.floor(Math.random() * vibes.length)];
  
  return `
Role: 你是一位最懂浪漫的城市生活家。
Task: 我已经通过地图锁定了一个真实地点，请你基于这个地点，为一个 [${relation}] 阶段的情侣，设计一个 [${date}] 的约会瞬间。

【已知真实情报】
- 📍 地点名称: ${realPlaceName}
- 🏷️ 场所类型: ${keywordCategory}
- 🗺️ 详细地址: ${realPlaceAddress}
- 🌡️ 实时天气: ${weatherContext} (必须根据天气调整玩法描述)
- ✨ 本次风格: ${randomVibe}

【你的任务】
不要再推荐其他地点了！就针对 "${realPlaceName}" 这个地方：
1. **Title**: 结合 "${keywordCategory}" 和 "${randomVibe}" 风格，起一个吸引人的标题。
2. **Activity**: 脑补一下在这里的具体玩法。
   - 如果是 "${relation}" 是初识，玩法要避免尴尬，有互动。
   - 如果天气是 "${weatherContext}"，请在描述中体现如何利用这个天气（例如：下雨就在窗边听雨，晴天就晒太阳）。
3. **Reason**: 为什么选这里？(一本正经地胡说八道，把这个地方夸得非常适合他们)。

【Output Format (JSON Only)】
请直接返回 JSON，不要 Markdown，格式如下：
{
  "title": "方案标题",
  "location": "${realPlaceName}", 
  "activity": "具体的玩法描述...",
  "reason": "推荐理由...",
  "tags": ["${keywordCategory}", "${randomVibe}", "标签3"]
}
`;
};

// 函数名统一改为 getAIRecommendation 以匹配 result.js
const getAIRecommendation = (params) => {
  return new Promise((resolve, reject) => {
    // 🛡️ 兜底逻辑：如果没有地点名（比如定位失败降级时），给个默认值
    if (!params.realPlaceName) {
      params.realPlaceName = "城市中心的某个角落";
      params.realPlaceAddress = "未知地址";
    }

    if (!API_KEY) {
      console.warn("未配置 API Key");
      // 模拟返回
      setTimeout(() => {
        resolve({
          title: "API未配置模式",
          location: params.realPlaceName,
          activity: "请检查 api.js 中的 API Key 配置",
          reason: "这是本地模拟数据",
          tags: ["模拟", "测试"]
        });
      }, 1000);
      return;
    }

    wx.request({
      url: API_URL,
      method: "POST",
      header: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      data: {
        model: MODEL_ID,
        messages: [
          { role: "system", content: "你是一个只输出 JSON 的约会助手。" },
          { role: "user", content: generatePrompt(params) }
        ],
        temperature: 0.8,
        response_format: { type: "json_object" }
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.choices) {
          try {
            let content = res.data.choices[0].message.content;
            content = content.replace(/```json/g, "").replace(/```/g, "").trim();
            const result = JSON.parse(content);
            
            // 强制确保返回的 location 是真实的地点名，防止 AI 幻觉修改名字
            result.location = params.realPlaceName; 
            
            resolve(result);
          } catch (e) {
            console.error("JSON 解析失败", e);
            reject("AI 罢工了，解析失败");
          }
        } else {
          console.error("API 报错", res);
          reject("服务商开小差了");
        }
      },
      fail: (err) => {
        reject("网络连接断开");
      }
    });
  });
};

module.exports = {
  getAIRecommendation
};