// utils/api.js
const API_KEY = ""; // ⚠️ 在这里填入你的流动硅基 API Key (Bearer token)
const API_URL = "https://api.siliconflow.cn/v1/chat/completions";

// 构造 Prompt
const generatePrompt = (data) => {
  const { relation, time, budget, location, date } = data;
  
  return `
Role: 你是一位极具创意的恋爱约会策划师，风格可爱、治愈、调皮。
Task: 根据用户输入生成一个具体的约会方案。

User Profile:
- 关系阶段: ${relation}
- 时间段: ${time}
- 预算: ${budget} 元
- 地点/城市: ${location}
- 日期/季节: ${date}

Output Format: 请务必只返回一段纯 JSON 格式数据，不要包含 Markdown 标记，格式如下：
{
  "title": "方案标题(可爱点)",
  "location": "推荐的具体地点",
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