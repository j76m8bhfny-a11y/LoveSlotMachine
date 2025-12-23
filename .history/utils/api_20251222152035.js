// utils/api.js
const API_KEY = ""; // ⚠️ 在这里填入你的流动硅基 API Key (Bearer token)
const API_URL = "https://api.siliconflow.cn/v1/chat/completions";

// 构造 Prompt
const generatePrompt = (data) => {
  const { relation, time, budget, location, date } = data;
  
  return `
Role: 你是一位极具创意的资深城市生活家 & 约会选址算法专家，风格可爱、治愈、调皮。
Profile：你不仅懂恋爱心理，更是一位深耕本地生活的“活地图”。你熟知各大城市的商圈分布、网红店铺的真实评价、交通便利度以及隐秘的宝藏小店。你的推荐标准严格参考“大众点评/美团”的高分逻辑（高颜值、高口味、服务好）以及“小红书”的审美趋势。

Task: 基于用户提供的多维条件，模拟本地生活APP的筛选逻辑，为用户精准定位一个**真实存在、营业时间合适、符合预算且具备城市特色**的最佳约会地点。

User Profile:
- 关系阶段: ${relation}
- 时间段: ${time}
- 预算: ${budget} 元
- 地点/城市: ${location}
- 日期/季节: ${date}

# Thinking Workflow (深度思考链 - 请严格执行)
1.  **城市定位与商圈筛选**：
    -   分析 ${location} 的特色。如果是成都，考虑茶馆/火锅；如果是上海，考虑梧桐区/外滩。
    -   根据 ${budget} 元预算锁定商圈。高预算锁定CBD/高端酒店区；低预算锁定大学城/文创园。

2.  **商家营业逻辑校验 (关键步骤)**：
    -   检查 ${time} (如清晨/深夜)。
    -   *BUG排查*：如果是上午，绝不推荐只有晚上开的酒吧或夜市；如果是深夜，绝不推荐商场内已打烊的店铺。
    -   *排队预判*：如果是周末饭点且是网红店，需在理由中提示“可能排队”。

3.  **关系与场景匹配 (安全与氛围)**：
    -   *刚认识*：必须选择交通便利、人流适中、半开放的场所（如购物中心内的精品咖啡、通过性好的展览），便于随时结束或转场，避免偏远或封闭环境。
    -   *热恋/稳定*：推荐私密性稍高、有体验感的场所（DIY、甚至稍微偏远但风景绝美的餐厅）。

4.  **最终决策**：
    -   选择一个具体名称（真实存在的知名店铺或地标，避免编造）。
    -   确保该地点符合当前季节（如冬天推荐有暖气的室内，夏天推荐有空调或夜风的地方）

Output Format: 请务必只返回一段纯 JSON 格式数据，不要包含 Markdown 标记，格式如下：
{
  "title": "方案标题(可爱点)",
  "location": "推荐的具体地点(必须真实存在)",
  "activity": "一句话玩法总结(调皮有趣)",
  "reason": "推荐理由(结合关系和预算)",
  "tags": ["标签1", "标签2", "标签3"]
}
`;
};

const getDatingAdvice = (params) => {
  return new Promise((resolve, reject) => {
    // 模拟演示模式：如果没有Key，返回假数据，防止报错
    if (!API_KEY) {
      setTimeout(() => {
        resolve({
          title: "逃离城市的落日野餐",
          location: "滨江森林公园大草坪",
          activity: "带上蓝牙音箱和比萨，在夕阳下比赛谁先数到第10架飞机。",
          reason: "非常适合热恋期的你们，低成本高浪漫，还能尽情撒欢。",
          tags: ["#落日收集者", "#草地打滚", "#氛围感"]
        });
      }, 2000);
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
        model: "deepseek-ai/DeepSeek-V3", // 使用流动硅基上的 DeepSeek V3 或其他模型
        messages: [
          { role: "user", content: generatePrompt(params) }
        ],
        temperature: 0.7,
        max_tokens: 512,
        response_format: { type: "json_object" } // 如果模型支持 JSON 模式
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.choices) {
          try {
            const content = res.data.choices[0].message.content;
            // 清理可能存在的 markdown 符号
            const cleanJson = content.replace(/```json/g, "").replace(/```/g, "");
            const result = JSON.parse(cleanJson);
            resolve(result);
          } catch (e) {
            reject("AI 数据解析失败");
          }
        } else {
          reject("API 请求失败");
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};

module.exports = {
  getDatingAdvice
};