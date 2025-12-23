const api = require('../../utils/api.js');

Page({
  data: {
    isLoading: true,
    spinning: true,
    showReceipt: false,
    inputData: {},
    result: null,
    retryCount: 0 // ✨ 新增：记录用户的重试次数
  },

  onLoad(options) {
    if (options.data) {
      const inputData = JSON.parse(decodeURIComponent(options.data));
      this.setData({ inputData });
      this.startProcess(inputData);
    }
  },

  startProcess(data) {
    this.setData({ isLoading: true, spinning: true });
    
    const requestData = {
      ...data,
      retryCount: this.data.retryCount
    };
    
    // 1. 发起 AI 请求
    api.getDatingAdvice(data)
      .then(res => {
        // 请求成功后，延迟一点时间让动画跑一会儿
        setTimeout(() => {
          this.setData({ 
            result: res,
            spinning: false 
          });
          
          // 停顿一下显示小票
          setTimeout(() => {
            this.setData({ isLoading: false, showReceipt: true });
            wx.vibrateLong(); // 出票震动
          }, 800);
          
        }, 2000); // 至少转2秒
      })
      .catch(err => {
        wx.showToast({ title: 'AI 睡着了，重试一下', icon: 'none' });
        this.setData({ spinning: false });
      });
  },

  reRoll() {
    this.setData({ showReceipt: false });
    this.startProcess(this.data.inputData);
  }
});