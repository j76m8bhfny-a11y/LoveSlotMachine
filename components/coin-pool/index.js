Component({
  properties: {
    // 父页面传入的预算金额
    value: {
      type: Number,
      value: 0,
      observer: 'onValueChange' // 监听值变化
    }
  },

  data: {
    coins: [], // 存储当前屏幕上的金币
    coinTypes: [
      '/assets/images/coin_front.png',
      '/assets/images/coin_side.png',
      '/assets/images/coin_tilt.png'
    ]
  },

  methods: {
    onValueChange(newVal, oldVal) {
      if (newVal === oldVal) return;

      // 1. 计算目标金币数量 (算法：每 50 元 1 个金币，最多显示 50 个防止卡顿)
      const targetCount = Math.min(Math.floor(newVal / 50), 50);
      const currentCount = this.data.coins.length;
      const diff = targetCount - currentCount;

      if (diff > 0) {
        // --- 场景 A: 预算增加，掉落金币 ---
        this.addCoins(diff);
      } else if (diff < 0) {
        // --- 场景 B: 预算减少，金币飞回 ---
        this.removeCoins(Math.abs(diff));
      }
    },

    addCoins(count) {
      const newCoins = [];
      const baseId = Date.now(); // 用时间戳做唯一ID前缀

      for (let i = 0; i < count; i++) {
        // 随机选择一张素材
        const src = this.data.coinTypes[Math.floor(Math.random() * this.data.coinTypes.length)];
        
        newCoins.push({
          id: `${baseId}_${i}`,
          src: src,
          // 随机位置 (0% - 85%)，留点边距
          left: Math.random() * 85,
          // 随机堆叠高度 (0 - 40rpx)，制造起伏感，不会排成一条直线
          bottom: Math.random() * 40, 
          // 随机层级，互相遮挡
          zIndex: Math.floor(Math.random() * 10),
          // 随机旋转 (-30度 到 30度)
          rotate: Math.floor(Math.random() * 60 - 30),
          // 随机延迟，避免同时落下太生硬
          delay: Math.random() * 0.2,
          isExiting: false
        });
      }

      // 增量更新，保留旧的，添加新的
      this.setData({
        coins: [...this.data.coins, ...newCoins]
      });
      
      // 触发震动反馈
      if (count > 0) wx.vibrateShort({ type: 'light' });
    },

    removeCoins(count) {
      const { coins } = this.data;
      if (coins.length === 0) return;

      // 我们从数组【末尾】开始移除，符合 LIFO 栈逻辑
      // 1. 先标记要移除的金币 (改变 class 触发飞回动画)
      const startIndex = coins.length - count;
      
      // 构建一个更新对象，只更新需要飞走的金币状态，性能更好
      const updates = {};
      for (let i = startIndex; i < coins.length; i++) {
        if (i >= 0) {
          updates[`coins[${i}].isExiting`] = true;
          // 飞回时给个随机延迟，像被吸尘器吸走一样
          updates[`coins[${i}].delay`] = (i - startIndex) * 0.05; 
        }
      }
      this.setData(updates);

      // 2. 等动画播完 (500ms) 后，真正从数据中删除
      setTimeout(() => {
        // 重新获取最新的 coins (防止这期间又有新操作)
        const currentCoins = this.data.coins;
        // 截断数组
        const remainingCoins = currentCoins.slice(0, currentCoins.length - count);
        this.setData({ coins: remainingCoins });
      }, 500);
    }
  }
});