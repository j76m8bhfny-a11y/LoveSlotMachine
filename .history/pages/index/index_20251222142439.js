Page({
  goToPlanner() {
    wx.navigateTo({
      url: '/pages/planner/planner',
    });
  },
  showBuildingToast() {
    wx.showToast({
      title: '装修师傅搬砖中...',
      icon: 'none',
      image: '', // 这里可以放一个安全帽的图片icon
      duration: 2000
    });
  }
})