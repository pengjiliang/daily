<template>
  <div>
    <!-- Hero -->
    <!-- Hero 轮播 -->
    <section class="hero">
      <el-carousel class="hero-carousel" height="600px" :interval="6000" arrow="hover">
        <el-carousel-item v-for="(s, i) in heroSlides" :key="s.bg">
          <div class="hero-slide" :style="heroSlideStyle(s.bg)">
            <div class="container hero-inner">
              <div class="hero-text">
                <span class="kicker light">{{ s.kicker }}</span>
                <h1>{{ s.title1 }}<template v-if="s.title2"><br /><span class="hero-accent">{{ s.title2 }}</span></template></h1>
                <p class="hero-p">{{ s.desc }}</p>
                <div class="hero-btns">
                  <el-button type="accent" size="large" round @click="router.push('/products')">
                    <el-icon><TakeawayBox /></el-icon>{{ t('home_browse') }}
                  </el-button>
                  <el-button size="large" round class="hero-ghost" @click="router.push('/contact')">{{ t('home_contact_btn') }}</el-button>
                </div>
                <div v-if="i === 0" class="hero-trust">
                  <span class="ht-item"><el-icon><CircleCheckFilled /></el-icon>{{ t('home_hero_badge1') }}</span>
                  <span class="ht-item"><el-icon><CircleCheckFilled /></el-icon>{{ t('home_hero_badge2') }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-carousel-item>
      </el-carousel>
    </section>

    <!-- 信任条带 -->
    <section class="trust-strip">
      <div class="container trust-grid">
        <div v-for="f in trustFeatures" :key="f.k" class="trust-item">
          <span class="trust-icon"><el-icon :size="24"><component :is="f.icon" /></el-icon></span>
          <div>
            <div class="trust-t">{{ t(f.t) }}</div>
            <div class="trust-d">{{ t(f.d) }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 产品分类 -->
    <section class="page-section">
      <div class="container">
        <div class="section-head">
          <span class="kicker">{{ t('home_cat_kicker') }}</span>
          <h2 class="section-title">{{ t('home_cat_title') }}</h2>
          <p class="section-sub">{{ t('cat_sub_all') }}</p>
        </div>
        <div class="cat-grid">
          <div
            v-for="c in catList"
            :key="c.key"
            class="cat-card card-hover"
            @click="$router.push({ path: '/products', query: { cat: c.key } })"
          >
            <span class="cat-icon"><el-icon :size="30"><component :is="c.icon" /></el-icon></span>
            <div class="cat-name">{{ c.name }}</div>
            <div class="cat-desc">{{ c.desc }}</div>
            <div class="cat-foot"><span>{{ c.count }} {{ t('products_count') }}</span><span class="cat-more">{{ t('products_view_all') }} →</span></div>
          </div>
        </div>
      </div>
    </section>

    <!-- 精选产品 -->
    <section class="page-section featured">
      <div class="container">
        <div class="section-head">
          <span class="kicker">{{ t('home_featured_kicker') }}</span>
          <h2 class="section-title">{{ t('home_featured_title') }}</h2>
          <p class="section-sub">{{ t('home_featured_sub') }}</p>
        </div>
        <div class="product-grid">
          <ProductCard v-for="p in featured" :key="p.id" :product="p" />
        </div>
        <div class="view-all">
          <el-button type="accent" round @click="$router.push('/products')">{{ t('home_view_all') }} →</el-button>
        </div>
      </div>
    </section>

    <!-- 数据统计条带 -->
    <section class="stats-band">
      <div class="container stats-grid">
        <div v-for="st in stats" :key="st.label" class="stat">
          <div class="stat-num">{{ st.num }}</div>
          <div class="stat-label">{{ t(st.label) }}</div>
        </div>
      </div>
    </section>

    <!-- 关于 -->
    <section class="page-section about-sec">
      <div class="container about-inner">
        <div class="about-visual">
          <div class="about-img-wrap"><img src="/images/about-company.jpg" alt="Yangliang Trade" loading="lazy" /></div>
        </div>
        <div class="about-text">
          <span class="kicker">{{ t('home_about_badge') }}</span>
          <h2 class="section-title">{{ t('home_about_title') }}</h2>
          <p>{{ t('home_about_p') }}</p>
          <ul class="about-list">
            <li><el-icon><CircleCheckFilled /></el-icon>{{ t('home_about_l1') }}</li>
            <li><el-icon><CircleCheckFilled /></el-icon>{{ t('home_about_l2') }}</li>
            <li><el-icon><CircleCheckFilled /></el-icon>{{ t('home_about_l3') }}</li>
            <li><el-icon><CircleCheckFilled /></el-icon>{{ t('home_about_l4') }}</li>
          </ul>
          <el-button type="primary" round @click="$router.push('/about')">{{ t('home_learn_more') }} →</el-button>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <div class="container cta-inner">
        <h2>{{ t('home_cta_title') }}</h2>
        <p>{{ t('home_cta_sub') }}</p>
        <el-button size="large" round type="accent" @click="$router.push('/contact')">
          <el-icon><ChatDotRound /></el-icon>{{ t('home_cta_btn') }}
        </el-button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ProductCard from '@/components/ProductCard.vue';
import { products, loadProducts } from '@/api/products';
import { categories } from '@/data/products';
import { t } from '@/i18n';
import {
  FirstAidKit, Monitor, Operation, Aim, MagicStick,
  TakeawayBox, CircleCheckFilled, Medal, Ship, Van, Tools, Service, ChatDotRound
} from '@element-plus/icons-vue';

const iconMap = { ppe: FirstAidKit, monitoring: Monitor, consumables: Operation, rehab: Aim, disinfection: MagicStick };
const trustFeatures = [
  { k: 'logistics', icon: Ship, t: 'home_trust_1t', d: 'home_trust_1d' },
  { k: 'cert', icon: Medal, t: 'home_trust_2t', d: 'home_trust_2d' },
  { k: 'oem', icon: Tools, t: 'home_trust_3t', d: 'home_trust_3d' },
  { k: 'support', icon: Service, t: 'home_trust_4t', d: 'home_trust_4d' }
];
const stats = [
  { num: '5000+', label: 'home_stat_label_clients' },
  { num: '30+', label: 'home_stat_label_countries' },
  { num: '200+', label: 'home_stat_label_products' },
  { num: '15+', label: 'home_stat_label_years' }
];

const catList = computed(() =>
  categories.filter((c) => c.key !== 'all').map((c) => ({
    ...c,
    icon: iconMap[c.key],
    name: t('catL_' + c.key),
    desc: t('cat_' + c.key),
    count: products.value.filter((p) => p.category === c.key).length
  }))
);
const featured = computed(() => products.value.slice(0, 6));
const router = useRouter();
const heroSlides = computed(() => [
  { bg: "/images/hero-medical-people.jpg", kicker: t("home_kicker"), title1: t("home_h1_1"), title2: t("home_h1_2"), desc: t("home_p") },
  { bg: "/images/hero-slide-1.jpg", kicker: t("home_s2_kicker"), title1: t("home_s2_title"), title2: "", desc: t("home_s2_desc") },
  { bg: "/images/hero-slide-2.jpg", kicker: t("home_s3_kicker"), title1: t("home_s3_title"), title2: "", desc: t("home_s3_desc") },
  { bg: "/images/hero-slide-3.jpg", kicker: t("home_s4_kicker"), title1: t("home_s4_title"), title2: "", desc: t("home_s4_desc") }
]);
const heroSlideStyle = (bg) => ({ backgroundImage: "linear-gradient(105deg, rgba(31,102,168,.88) 0%, rgba(64,158,255,.50) 48%, rgba(121,187,255,.12) 100%), url(" + bg + ")" });

onMounted(() => loadProducts());
</script>

<style scoped>
/* Hero 轮播 */
.hero { position: relative; color: #fff; overflow: hidden; }
.hero-carousel .el-carousel__container { height: 600px; }
.hero-carousel .el-carousel__arrow { width: 44px; height: 44px; background: rgba(0,0,0,.18); font-size: 16px; }
.hero-carousel .el-carousel__arrow:hover { background: rgba(64,158,255,.85); }
.hero-carousel .el-carousel__indicator .el-carousel__button { background: rgba(255,255,255,.55); height: 4px; border-radius: 2px; width: 22px; }
.hero-carousel .el-carousel__indicator.is-active .el-carousel__button { background: #fff; width: 34px; }
.hero-slide { height: 100%; display: flex; align-items: center; background-size: cover; background-position: center; }
.hero-inner { position: relative; display: grid; grid-template-columns: 1fr; gap: 56px; align-items: center; }
.hero-text { max-width: 680px; }
.kicker.light { background: rgba(255,255,255,.18); color: #fff; }
.hero h1 { font-size: 46px; line-height: 1.25; margin: 0 0 20px; font-weight: 800; }
.hero-accent { color: #d9ecff; }
.hero-p { font-size: 16px; color: #e6f0ff; line-height: 1.9; margin: 0 0 30px; max-width: 560px; }
.hero-btns { display: flex; gap: 14px; margin-bottom: 30px; flex-wrap: wrap; }
.hero-ghost { --el-button-bg-color: rgba(255,255,255,.16); --el-button-border-color: #fff; --el-button-text-color: #fff; --el-button-hover-bg-color: rgba(255,255,255,.28); --el-button-hover-border-color: #fff; --el-button-hover-text-color: #fff; }
.hero-trust { display: flex; gap: 22px; flex-wrap: wrap; }
.ht-item { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: #e6f0ff; }
.ht-item .el-icon { color: #4ade80; }

/* 信任条带 */
.trust-strip { background: #fff; border-bottom: 1px solid #eef2f7; }
.trust-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; padding: 36px 24px; }
.trust-item { display: flex; gap: 14px; align-items: flex-start; }
.trust-icon { width: 48px; height: 48px; flex: none; border-radius: 10px; background: rgba(64,158,255,.08); color: var(--yl-primary); display: flex; align-items: center; justify-content: center; }
.trust-t { font-size: 16px; font-weight: 700; color: var(--yl-primary-dark); margin-bottom: 4px; }
.trust-d { font-size: 13px; color: var(--yl-text-light); line-height: 1.6; }

/* 分类 */
.cat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; }
.cat-card { background: #fff; border: 1px solid #eef2f7; border-radius: var(--yl-radius); padding: 28px 20px; text-align: center; cursor: pointer; display: flex; flex-direction: column; }
.cat-icon { width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 50%; background: linear-gradient(135deg, rgba(64,158,255,.10), rgba(121,187,255,.18)); color: var(--yl-primary); display: flex; align-items: center; justify-content: center; }
.cat-name { font-weight: 700; margin: 0 0 6px; font-size: 16px; color: var(--yl-primary-dark); }
.cat-desc { font-size: 13px; color: var(--yl-text-light); flex: 1; }
.cat-foot { margin-top: 16px; padding-top: 14px; border-top: 1px dashed #e8edf5; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--yl-text-light); }
.cat-more { color: var(--yl-accent); font-weight: 600; }

/* 精选 */
.featured { background: #fff; }
.product-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.view-all { text-align: center; margin-top: 40px; }

/* 数据条带 */
.stats-band { background: linear-gradient(135deg, #337ecc, #409eff); color: #fff; padding: 56px 0; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; text-align: center; }
.stat-num { font-size: 40px; font-weight: 800; color: #fff; }
.stat-label { font-size: 14px; color: #e6f0ff; margin-top: 6px; }

/* 关于 */
.about-sec { background: var(--yl-bg); }
.about-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.about-visual { position: relative; }
.about-img-wrap { border-radius: 18px; overflow: hidden; box-shadow: var(--yl-shadow-lg); }
.about-img-wrap img { width: 100%; height: 400px; object-fit: cover; display: block; border-radius: 0; }
.about-text p { color: var(--yl-text-light); line-height: 1.9; }
.about-list { list-style: none; padding: 0; margin: 0 0 26px; }
.about-list li { display: flex; align-items: center; gap: 10px; color: var(--yl-text); line-height: 2.2; }
.about-list .el-icon { color: var(--yl-primary); }

/* CTA */
.cta { background: linear-gradient(135deg, #409eff, #337ecc); padding: 60px 0; color: #fff; text-align: center; position: relative; overflow: hidden; }
.cta h2 { margin: 0 0 10px; font-size: 30px; }
.cta p { opacity: .92; margin: 0 0 26px; }
.cta .el-button--accent { --el-button-bg-color: #fff; --el-button-border-color: #fff; --el-button-text-color: #409eff; --el-button-hover-bg-color: #ecf5ff; --el-button-hover-border-color: #fff; --el-button-hover-text-color: #409eff; }

@media (max-width: 900px) {
  .hero-carousel .el-carousel__container { height: 520px; }
  .hero-inner, .about-inner { grid-template-columns: 1fr; }
  .cat-grid { grid-template-columns: repeat(2, 1fr); }
  .product-grid { grid-template-columns: repeat(2, 1fr); }
  .trust-grid, .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
