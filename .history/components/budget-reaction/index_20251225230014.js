Component({
  properties: {
    value: {
      type: Number,
      value: 0,
      observer: 'updateState' // 监听 budget 变化
    }
  },

  data: {
    emoji: '🙂',
    text: '准备出发',
    animClass: ''
  },

  methods: {
    updateState(val) {
      // 1. 定义 5 个心情阶段
      let newState = {};
      
      if (val < 100) {
        newState = { emoji: '🥺', text: '求带飞...' }; // 穷游
      } else if (val < 300) {
        newState = { emoji: '🙂', text: '简单快乐' }; // 正常
      } else if (val < 800) {
        newState = { emoji: '😍', text: '心动的感觉!' }; // 约会
      } else if (val < 2000) {
        newState = { emoji: '😎', text: '霸道总裁' }; // 轻奢
      } else {
        newState = { emoji: '🤑', text: '壕无人性!!' }; // 土豪
      }

      // 2. 只有当表情真正改变时，才触发动画
      // (防止滑块微调数字时，表情一直在鬼畜闪烁)
      if (newState.emoji !== this.data.emoji) {
        this.setData({
          emoji: newState.emoji,
          text: newState.text,
          animClass: 'pop' // 添加动画类
        });
        
        // 触发简单的触感反馈
        wx.vibrateShort({ type: 'medium' });

        // 3. 动画播完后移除类名，方便下次再次触发
        setTimeout(() => {
          this.setData({ animClass: '' });
        }, 500);
      }
    }
  }
});