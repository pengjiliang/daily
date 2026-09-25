<template>
  <div>
    <!-- Hero -->
    <section class="hero">
      <div class="container hero-inner">
        <div class="hero-text">
          <h1>专业医疗器械<br /><span class="gradient-text">进出口贸易服务商</span></h1>
          <p>
            扬良贸易有限公司专注医疗器械与医用产品，覆盖防护用品、监测设备、耗材器械、护理康复与消毒净化，为全球客户提供高品质产品与一站式贸易服务。
          </p>
          <div class="hero-btns">
            <el-button type="primary" size="large" round @click="$router.push('/products')">浏览产品</el-button>
            <el-button size="large" round @click="$router.push('/contact')">联系我们</el-button>
          </div>
          <div class="hero-stats">
            <div class="stat">
              <div class="num">5000+</div>
              <div class="label">合作客户</div>
            </div>
            <div class="stat">
              <div class="num">300+</div>
              <div class="label">出口国家</div>
            </div>
            <div class="stat">
              <div class="num">100+</div>
              <div class="label">产品品类</div>
            </div>
          </div>
        </div>
        <div class="hero-visual">
          <img src="/images/hero-medical.svg" alt="医疗产品" />
        </div>
      </div>
    </section>

    <!-- 分类 -->
    <section class="page-section">
      <div class="container">
        <h2 class="section-title">产品分类</h2>
        <p class="section-sub">覆盖医疗器械与医用产品核心品类，支持 OEM 定制与批量出口</p>
        <div class="cat-grid">
          <div
            v-for="c in catList"
            :key="c.key"
            class="cat-card card-hover"
            @click="$router.push({ path: '/products', query: { cat: c.key } })"
          >
            <el-icon :size="34" color="#2563eb"><component :is="c.icon" /></el-icon>
            <div class="cat-name">{{ c.label }}</div>
            <div class="cat-desc">{{ c.desc }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 精选产品 -->
    <section class="page-section featured">
      <div class="container">
        <div class="head-row">
          <div>
            <h2 class="section-title">精选产品</h2>
            <p class="section-sub">品质保证 · 认证齐全 · 服务全球</p>
          </div>
          <el-button text type="primary" @click="$router.push('/products')">查看全部 →</el-button>
        </div>
        <div class="product-grid">
          <ProductCard v-for="p in featured" :key="p.id" :product="p" />
        </div>
      </div>
    </section>

    <!-- 关于 -->
    <section class="page-section about-sec">
      <div class="container about-inner">
        <div class="about-visual">
          <img src="/images/product-syringe.svg" alt="扬良贸易" />
          <img class="about-sub" src="/images/product-bp-monitor.svg" alt="扬良贸易" />
        </div>
        <div class="about-text">
          <h2 class="section-title">关于扬良贸易</h2>
          <p>
            扬良贸易有限公司深耕医疗器械与医用产品领域，建立了严格的质量管控体系与稳定的全球供应链，产品远销亚洲、非洲等地区。
          </p>
          <ul class="about-list">
            <li>◆ 医疗器械全品类供应，规格齐全</li>
            <li>◆ CE / FDA / ISO 认证体系保障</li>
            <li>◆ 支持样品、OEM / ODM 定制</li>
            <li>◆ 专业团队提供贸易与物流支持</li>
          </ul>
          <el-button type="primary" round @click="$router.push('/about')">了解更多</el-button>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <div class="container cta-inner">
        <h2>需要医疗器械采购方案？</h2>
        <p>立即联系我们的销售团队，获取产品目录与报价</p>
        <el-button size="large" round type="warning" @click="$router.push('/contact')">WhatsApp 联系我们</el-button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import ProductCard from '@/components/ProductCard.vue';
import { products, loadProducts } from '@/api/products';
import { categories } from '@/data/products';
import { FirstAidKit, Monitor, Operation, Aim, MagicStick } from '@element-plus/icons-vue';

const iconMap = {
  ppe: FirstAidKit,
  monitoring: Monitor,
  consumables: Operation,
  rehab: Aim,
  disinfection: MagicStick,
};
const catList = computed(() =>
  categories.filter((c) => c.key !== 'all').map((c) => ({ ...c, icon: iconMap[c.key], desc: CAT_DESC[c.key] })),
);
const featured = computed(() => products.value.slice(0, 6));

onMounted(() => loadProducts());

const CAT_DESC = {
  ppe: '口罩、手套等防护耗材',
  monitoring: '血压计、体温计等监测设备',
  consumables: '注射器、输液器等一次性耗材',
  rehab: '敷料、轮椅等护理康复产品',
  disinfection: '医用消毒与净化设备',
};
</script>

<style scoped>
.hero {
  background: linear-gradient(120deg, #eef6ff 0%, #f4fbff 55%, #e9f7ff 100%);
  padding: 72px 0;
}
.hero-inner {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 48px;
  align-items: center;
}
.hero h1 {
  font-size: 44px;
  line-height: 1.25;
  margin: 0 0 20px;
}
.hero p {
  font-size: 16px;
  color: var(--yl-text-light);
  line-height: 1.9;
  margin: 0 0 28px;
}
.hero-btns {
  display: flex;
  gap: 12px;
  margin-bottom: 40px;
}
.hero-stats {
  display: flex;
  gap: 44px;
}
.stat .num {
  font-size: 28px;
  font-weight: 800;
  color: var(--yl-primary);
}
.stat .label {
  color: var(--yl-text-light);
  font-size: 14px;
  margin-top: 4px;
}
.hero-visual img {
  width: 100%;
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(14, 165, 233, 0.25);
}

.cat-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
}
.cat-card {
  background: #fff;
  border: 1px solid #eef2f7;
  border-radius: var(--yl-radius);
  padding: 28px 20px;
  text-align: center;
  cursor: pointer;
}
.cat-name {
  font-weight: 700;
  margin: 14px 0 6px;
  font-size: 16px;
}
.cat-desc {
  font-size: 13px;
  color: var(--yl-text-light);
}

.featured {
  background: #fff;
}
.head-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.about-sec {
  background: var(--yl-bg);
}
.about-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
}
.about-visual {
  position: relative;
}
.about-visual img {
  width: 78%;
  border-radius: 18px;
  box-shadow: 0 20px 48px rgba(37, 99, 235, 0.18);
}
.about-visual .about-sub {
  position: absolute;
  width: 46%;
  right: 0;
  bottom: -28px;
  border: 6px solid #fff;
}
.about-text p {
  color: var(--yl-text-light);
  line-height: 1.9;
}
.about-list {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
  color: var(--yl-text);
  line-height: 2.1;
}

.cta {
  background: linear-gradient(90deg, var(--yl-primary), var(--yl-cyan));
  padding: 64px 0;
  color: #fff;
  text-align: center;
}
.cta h2 {
  margin: 0 0 8px;
  font-size: 30px;
}
.cta p {
  opacity: 0.9;
  margin: 0 0 24px;
}

@media (max-width: 900px) {
  .hero-inner,
  .about-inner {
    grid-template-columns: 1fr;
  }
  .cat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
