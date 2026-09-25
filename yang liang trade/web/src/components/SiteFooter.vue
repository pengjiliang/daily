<template>
  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <div class="brand-name">扬良贸易有限公司</div>
        <p class="muted">YANGLIANG TRADE CO., LTD.</p>
        <p class="muted">专注医疗器械与医用产品进出口贸易，服务全球客户。</p>
      </div>
      <div class="footer-col">
        <div class="footer-title">快速导航</div>
        <router-link to="/products">产品中心</router-link>
        <router-link to="/about">关于我们</router-link>
        <router-link to="/contact">联系我们</router-link>
      </div>
      <div class="footer-col">
        <div class="footer-title">联系方式</div>
        <span>电话：+86 138 7499 0232</span>
        <span>邮箱：sales@yangliang-trade.com</span>
        <span>地址：中国 · 义乌</span>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="container">© 2026 扬良贸易有限公司 YANGLIANG TRADE CO., LTD. 保留所有权利</div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  margin-top: auto;
  background: #0f172a;
  color: #cbd5e1;
}
.footer-inner {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 40px;
  padding: 56px 24px 40px;
}
.brand-name {
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 12px;
}
.muted {
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.8;
  margin: 4px 0;
}
.footer-title {
  color: #fff;
  font-weight: 600;
  margin-bottom: 16px;
}
.footer-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
}
.footer-col a:hover {
  color: #38bdf8;
}
.footer-bottom {
  border-top: 1px solid #1e293b;
  padding: 18px 0;
  font-size: 13px;
  color: #64748b;
  text-align: center;
}
</style>
