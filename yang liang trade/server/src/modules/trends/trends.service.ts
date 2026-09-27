import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from '../../entities/product.entity'
import { TrendConfig } from '../../entities/trend-config.entity'
import { HOT_KEYWORDS } from '../../common/hot-keywords'

export interface TrendKeyword {
  keyword: string
  label: string
  category: string
  categoryLabel: string
  series: number[]
  hot: number
  direction: 'up' | 'down' | 'flat'
  covered: boolean
  productCount: number
  products: string[]
}


const CAT_LABEL: Record<string, string> = {
  ppe: '防护用品',
  monitoring: '监测设备',
  consumables: '耗材器械',
  rehab: '护理康复',
  disinfection: '消毒净化'
}

const SOURCE_LABEL: Record<string, string> = {
  trends: 'Google Trends 实时数据',
  ads: 'Google Ads API 数据',
  demo: '演示数据'
}

@Injectable()
export class TrendsService {
  constructor(
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(TrendConfig) private configs: Repository<TrendConfig>
  ) {}

  // 首次访问时生成默认配置行：默认使用方案1（Google Trends 实时）
  private async ensureConfig(): Promise<TrendConfig> {
    const list = await this.configs.find()
    if (list.length) return list[0]
    return this.configs.save({ mode: 'trends', proxyUrl: '', geo: '', adsDeveloperToken: '', adsClientId: '', adsClientSecret: '', adsRefreshToken: '', adsCustomerId: '' })
  }

  async getConfig(): Promise<TrendConfig> {
    return this.ensureConfig()
  }

  async saveConfig(dto: Partial<TrendConfig>): Promise<TrendConfig> {
    const cfg = await this.ensureConfig()
    Object.assign(cfg, dto)
    return this.configs.save(cfg)
  }

  async overview() {
    const cfg = await this.ensureConfig()
    const all = await this.products.find()
    let mode = cfg.mode || 'trends'
    let note = ''
    let seriesMap: Record<string, number[]> | null = null
    if (mode === 'trends') {
      try {
        seriesMap = await this.fetchAllTrends(HOT_KEYWORDS.map((k) => k.keyword), cfg)
      } catch (e) {
        mode = 'demo'
        note = `Google Trends 获取失败，已回退演示数据：${e.message}`
      }
    } else if (mode === 'ads') {
      try {
        seriesMap = await this.fetchAllAds(HOT_KEYWORDS.map((k) => k.keyword), cfg)
      } catch (e) {
        mode = 'demo'
        note = `Google Ads API 获取失败，已回退演示数据：${e.message}`
      }
    }
    const items: TrendKeyword[] = HOT_KEYWORDS.map((k) => {
      const series = (seriesMap && seriesMap[k.keyword]) || this.genSeries(k.keyword)
      const hot = series[series.length - 1]
      const direction = this.direction(series)
      const matched = all.filter((p) => this.match(p, k.keyword))
      return {
        ...k,
        categoryLabel: CAT_LABEL[k.category] || '',
        series,
        hot,
        direction,
        covered: matched.length > 0,
        productCount: matched.length,
        products: matched.slice(0, 8).map((p) => p.name)
      }
    })
    const covered = items.filter((i) => i.covered).length
    const hotWords = items.filter((i) => i.hot >= 70).length
    return {
      source: mode,
      sourceLabel: SOURCE_LABEL[mode] || mode,
      sourceNote: note,
      updatedAt: new Date().toISOString(),
      score: Math.round((covered / items.length) * 100),
      total: items.length,
      covered,
      hotWords,
      items
    }
  }

  private async fetchAllTrends(keywords: string[], cfg: TrendConfig): Promise<Record<string, number[]>> {
    const out: Record<string, number[]> = {}
    const CHUNK = 5
    for (let i = 0; i < keywords.length; i += CHUNK) {
      const chunk = keywords.slice(i, i + CHUNK)
      const results = await Promise.all(
        chunk.map(async (kw) => {
          try {
            return { kw, series: await this.fetchTrend(kw, cfg) }
          } catch {
            return { kw, series: null }
          }
        })
      )
      for (const r of results) if (r.series) out[r.kw] = r.series
    }
    if (!Object.keys(out).length) throw new Error('所有关键词请求均失败，请检查网络/代理配置')
    return out
  }

  // 方案1：Google Trends 实时搜索热度（非官方接口，无需 key；支持代理）
  private async fetchTrend(keyword: string, cfg: TrendConfig): Promise<number[]> {
    const googleTrends = require('google-trends-api')
    const { HttpsProxyAgent } = require('https-proxy-agent')
    const options: any = {
      keyword,
      startTime: new Date(Date.now() - 365 * 24 * 3600 * 1000),
      endTime: new Date()
    }
    if (cfg.geo) options.geo = cfg.geo
    if (cfg.proxyUrl) options.agent = new HttpsProxyAgent(cfg.proxyUrl)
    const raw = await googleTrends.interestOverTime(options)
    const json = JSON.parse(raw)
    const timeline = json?.default?.timelineData || []
    if (!timeline.length) throw new Error(`关键词「${keyword}」无趋势数据`)
    const buckets = new Map<number, number[]>()
    for (const p of timeline) {
      const d = new Date(p.time)
      const key = d.getFullYear() * 12 + d.getMonth()
      const v = Number(Array.isArray(p.value) ? p.value[0] : p.value)
      if (!Number.isFinite(v)) continue
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(v)
    }
    const series = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, vals]) => Math.round(vals.reduce((s, v) => s + v, 0) / vals.length))
      .slice(-12)
    if (!series.length) throw new Error(`关键词「${keyword}」无趋势数据`)
    while (series.length < 12) series.unshift(series[0])
    return series
  }

  // 方案2：Google Ads API（官方合规；需配置 developer token / OAuth 等）
  private async fetchAllAds(keywords: string[], cfg: TrendConfig): Promise<Record<string, number[]>> {
    const required = [cfg.adsDeveloperToken, cfg.adsClientId, cfg.adsClientSecret, cfg.adsRefreshToken, cfg.adsCustomerId]
    if (required.some((v) => !v)) throw new Error('Google Ads API 配置不完整，请到「数据源配置」填写')
    const out: Record<string, number[]> = {}
    const token = await this.adsAccessToken(cfg)
    for (const kw of keywords) {
      try {
        const series = await this.fetchAds(kw, cfg, token)
        if (series) out[kw] = series
      } catch {
        // 单个关键词失败则忽略，缺失的用演示数据兜底
      }
    }
    if (!Object.keys(out).length) throw new Error('Google Ads API 未返回任何关键词历史指标')
    return out
  }

  private async adsAccessToken(cfg: TrendConfig): Promise<string> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: cfg.adsClientId,
        client_secret: cfg.adsClientSecret,
        refresh_token: cfg.adsRefreshToken
      })
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok || !json.access_token) throw new Error(`Google OAuth2 换取 token 失败：${json.error_description || json.error || res.status}`)
    return json.access_token
  }

  private async fetchAds(keyword: string, cfg: TrendConfig, token: string): Promise<number[] | null> {
    const query =
      `SELECT keyword_plan_keyword.text, ` +
      `keyword_plan_keyword.keyword_plan_historical_metrics.keyword_impressions ` +
      `FROM keyword_plan_keyword WHERE keyword_plan_keyword.text = '${keyword}'`
    const res = await fetch(
      `https://googleads.googleapis.com/v18/customers/${cfg.adsCustomerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'developer-token': cfg.adsDeveloperToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      }
    )
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Google Ads API 查询失败：${json.error?.message || res.status}`)
    const rows = (json.results || []).flatMap((batch: any) => batch.results || [])
    const row = rows.find((r: any) => r.keywordPlanKeyword?.keywordPlanHistoricalMetrics)
    const arr = row?.keywordPlanKeyword?.keywordPlanHistoricalMetrics?.keywordImpressions
    if (!Array.isArray(arr) || !arr.length) return null
    // keywordImpressions：[0] 为最近月份，共 12 个月；逆转为旧→新，log 归一化到 0-100
    return arr
      .slice(0, 12)
      .reverse()
      .map((v: string) => Math.min(100, Math.max(1, Math.round(Math.log10(Number(v) + 1) * 20))))
  }

  private match(p: Product, keyword: string): boolean {
    const text = [p.name, p.nameEn, p.spec, p.categoryLabel, p.subCategory].join(' ').toLowerCase()
    return text.includes(keyword.toLowerCase())
  }

  // 确定性伪随机生成 12 个月趋势（演示数据），同一关键词每次结果一致
  private genSeries(keyword: string): number[] {
    const seed = hash(keyword)
    const out: number[] = []
    for (let i = 0; i < 12; i++) {
      const wave = Math.sin(i / 2 + (seed % 7)) * 12
      const drift = ((seed % 29) / 29) * 24 + i * (((seed >> 3) % 5) - 2)
      const noise = ((seed * (i + 3)) % 11) - 5
      out.push(Math.max(8, Math.min(100, Math.round(48 + wave + drift + noise))))
    }
    return out
  }

  private direction(series: number[]): 'up' | 'down' | 'flat' {
    const recent = series.slice(-3).reduce((a, b) => a + b, 0) / 3
    const prev = series.slice(-6, -3).reduce((a, b) => a + b, 0) / 3
    const diff = recent - prev
    if (diff > 4) return 'up'
    if (diff < -4) return 'down'
    return 'flat'
  }
}

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}
