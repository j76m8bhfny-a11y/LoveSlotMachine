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
const getAIRecommendation = (data) => {
  return new Promise((resolve, reject) => {
    
    // 1. 提取关键信息
    const { 
      weatherContext = '未知', 
      relation = '朋友', 
      keywordCategory = '好玩的地方', 
      realPlaceName = '',
      budget = 0
    } = data;

    // 2. 🔥 核心：写一个“说人话”的 Prompt 🔥
    // 我们用一段非常口语化的指令来“催眠”AI
    const systemPrompt = `
      你是一个南京本地的“约会嘴替”，说话风趣、简短、一针见血。
      你的任务是根据用户的【关系】和【天气】，用【一句话】推荐这个地方。
      
      🚫 禁止事项：
      1. 绝对不要出现“风和日丽”、“历史底蕴”、“不仅...而且”这种AI味很重的词。
      2. 绝对不要重复地点的名字（用户已经看见标题了）。
      3. 字数严格控制在 40 字以内！越短越好！
      
      ✅ 语言风格：
      - 如果是情侣，就有点暧昧或浪漫。
      - 如果是兄弟/朋友，就随意、接地气。
      - 像发朋友圈或者微信语音那样的语气。
    `;

    const userPrompt = `
      现在情况是：
      天气：${weatherContext}
      关系：${relation}
      地点类型：${keywordCategory}
      具体地点：${realPlaceName}
      
      请直接给我一句推荐语：
    `;

    // 3. 调用你的云函数或大模型接口
    // (这里假设你用的是微信云开发或其他接口，保持你原有的调用方式不变)
    // (只需把上面的 prompt 塞进去)
    
    wx.cloud.callFunction({
      name: 'deepseek', // 或者你的云函数名
      data: {
        // 将新的 prompt 传过去
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ]
      },
      success: res => {
        // 假设返回的数据在 res.result.content
        resolve({
          reason: res.result.content // 这里拿到的就是很短的“人话”了
        });
      },
      fail: err => {
        // 兜底文案 (万一AI挂了，也要说人话)
        const fallback = [
            "别想了，直接冲，这地方绝对不踩雷！",
            "这天气去这里简直绝配，信我！",
            "此时无声胜有声，带TA去就对了。",
            "氛围感拉满，不管是拍照还是聊天都合适。"
        ];
        resolve({
          reason: fallback[Math.floor(Math.random() * fallback.length)]
        });
      }
    });
  });
};

module.exports = {
  getAIRecommendation
};