import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CustomsConfig } from '../../entities/customs-config.entity'

export interface CustomsRecord {
  date: string
  direction: 'import' | 'export'
  hsCode: string
  hsName: string
  description: string
  qty: number
  unit: string
  amount: number
  country: string
  port: string
  ship: string
}

export interface CustomsQueryResult {
  source: string
  sourceLabel: string
  note: string
  updatedAt: string
  website: string
  company: { name: string; country: string; address: string; founded: string; employees: string; products: string[] }
  summary: { totalImport: number; totalExport: number; totalRecords: number; partnerCount: number; topPartners: { country: string; amount: number; count: number }[] }
  monthly: { month: string; importAmount: number; exportAmount: number; importCount: number; exportCount: number }[]
  records: CustomsRecord[]
}

const SOURCE_LABEL: Record<string, string> = { demo: '演示数据', futian: '富通天下' }

// 医疗器械/医用产品常见 HS 编码（演示数据用）
const HS_CODES = [
  { code: '9018.90', name: '血压计、体温计等医疗诊断器械' },
  { code: '9019.10', name: '按摩理疗仪器' },
  { code: '9021.10', name: '矫形器具' },
  { code: '9022.12', name: 'X 射线检查设备' },
  { code: '9011.10', name: '显微镜' },
  { code: '3005.10', name: '医用敷料及纱布' },
  { code: '4015.11', name: '医用橡胶手套' },
  { code: '9018.31', name: '注射器' },
  { code: '9018.11', name: '心电图机' },
  { code: '9402.10', name: '医疗用家具' },
  { code: '8713.10', name: '非机动轮椅' },
  { code: '9020.00', name: '呼吸防护装置' }
]

// 主要贸易国家与常用目的/起运港
const TRADE_ROUTES = [
  { country: '美国', port: '洛杉矶港' },
  { country: '美国', port: '纽约-新泽西港' },
  { country: '德国', port: '汉堡港' },
  { country: '英国', port: '费利克斯托港' },
  { country: '荷兰', port: '鹿特丹港' },
  { country: '法国', port: '勒阿弗尔港' },
  { country: '阿联酋', port: '杰贝阿里港' },
  { country: '沙特阿拉伯', port: '吉达港' },
  { country: '泰国', port: '林查班港' },
  { country: '越南', port: '胡志明港' },
  { country: '马来西亚', port: '巴生港' },
  { country: '印度尼西亚', port: '丹戎不碌港' },
  { country: '印度', port: '尼赫鲁港' },
  { country: '日本', port: '东京港' },
  { country: '韩国', port: '釜山港' },
  { country: '澳大利亚', port: '悉尼港' },
  { country: '尼日利亚', port: '拉各斯港' },
  { country: '埃及', port: '塞得港' },
  { country: '肯尼亚', port: '蒙巴萨港' },
  { country: '巴西', port: '桑托斯港' },
  { country: '墨西哥', port: '曼萨尼约港' },
  { country: '俄罗斯', port: '圣彼得堡港' }
]

const SHIPS = ['COSCO', 'MAERSK', 'MSC', 'CMA CGM', 'EVERGREEN', 'ONE', 'HMM', 'OOCL', 'YANG MING', 'ZIM']

// 字符串确定性哈希（同域名每次结果一致）
function hash(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

// 简单确定性伪随机数发生器
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

@Injectable()
export class CustomsService {
  private readonly logger = new Logger(CustomsService.name)

  constructor(
    @InjectRepository(CustomsConfig) private configs: Repository<CustomsConfig>
  ) {}

  // 首次访问时生成默认配置行：默认使用演示数据
  private async ensureConfig(): Promise<CustomsConfig> {
    const list = await this.configs.find()
    if (list.length) return list[0]
    return this.configs.save({ mode: 'demo', futianUsername: '', futianPassword: '' })
  }

  async getConfig(): Promise<CustomsConfig> {
    return this.ensureConfig()
  }

  async saveConfig(dto: Partial<CustomsConfig>): Promise<CustomsConfig> {
    const cfg = await this.ensureConfig()
    Object.assign(cfg, dto)
    return this.configs.save(cfg)
  }

  async query(website: string): Promise<CustomsQueryResult> {
    const cfg = await this.ensureConfig()
    const mode = cfg.mode || 'demo'
    if (mode === 'futian' && cfg.futianUsername && cfg.futianPassword) {
      try {
        return await this.fetchFutian(website, cfg)
      } catch (e) {
        this.logger.warn(`富通天下查询失败，回退演示数据：${e.message}`)
        return this.demoQuery(website, `富通天下查询失败，已回退演示数据：${e.message}`)
      }
    }
    if (mode === 'futian') {
      return this.demoQuery(website, '富通天下账号未配置，当前使用演示数据，请到「数据源配置」填写账号后切换真实源')
    }
    return this.demoQuery(website, '')
  }

  // 演示模式：根据域名确定性生成公司信息 + 近一年进出口记录
  private demoQuery(website: string, note: string): CustomsQueryResult {
    const seed = hash(website.toLowerCase())
    const rnd = mulberry32(seed)
    const host = website.replace(/^www\./, '')
    const domainMain = host.split('.')[0] || 'global'
    const words = domainMain.split(/[-_]/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    const baseName = words.join(' ') || 'Global'
    const suffixes = ['Import & Export Co., Ltd.', 'Trading Co., Ltd.', 'Medical Supplies Co., Ltd.', 'International Trade Co., Ltd.']
    const companyName = `${baseName} ${suffixes[seed % suffixes.length]}`

    const countries = [...new Set(TRADE_ROUTES.map((r) => r.country))]
    const country = countries[seed % countries.length]
    const cities: Record<string, string> = { '美国': '洛杉矶', '德国': '柏林', '英国': '伦敦', '荷兰': '阿姆斯特丹', '法国': '巴黎', '阿联酋': '迪拜', '沙特阿拉伯': '利雅得', '泰国': '曼谷', '越南': '胡志明市', '马来西亚': '吉隆坡', '印度尼西亚': '雅加达', '印度': '孟买', '日本': '东京', '韩国': '首尔', '澳大利亚': '悉尼', '尼日利亚': '拉各斯', '埃及': '开罗', '肯尼亚': '内罗毕', '巴西': '圣保罗', '墨西哥': '墨西哥城', '俄罗斯': '莫斯科' }
    const city = cities[country] || '上海'
    const founded = 1990 + (seed % 30)
    const employees = ['11-50 人', '51-200 人', '201-500 人', '501-1000 人'][seed % 4]
    const products = HS_CODES.slice(0, 4).map((h) => h.name)

    // 生成近 12 个月进出口记录（出口为主）
    const records: CustomsRecord[] = []
    const now = new Date()
    const monthly: CustomsQueryResult['monthly'] = []
    const partnerMap = new Map<string, { amount: number; count: number }>()

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      const recordCount = 4 + Math.floor(rnd() * 6) // 每月 4-9 笔
      let importAmount = 0
      let exportAmount = 0
      let importCount = 0
      let exportCount = 0

      for (let j = 0; j < recordCount; j++) {
        const direction: 'import' | 'export' = rnd() < 0.3 ? 'import' : 'export'
        const route = TRADE_ROUTES[Math.floor(rnd() * TRADE_ROUTES.length)]
        const hs = HS_CODES[Math.floor(rnd() * HS_CODES.length)]
        const qty = 100 + Math.floor(rnd() * 90000)
        const amount = Math.round((1000 + rnd() * 40000) * 100) / 100
        const day = 1 + Math.floor(rnd() * 27)
        const record: CustomsRecord = {
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          direction,
          hsCode: hs.code,
          hsName: hs.name,
          description: hs.name,
          qty,
          unit: '件',
          amount,
          country: direction === 'export' ? route.country : country,
          port: route.port,
          ship: SHIPS[Math.floor(rnd() * SHIPS.length)]
        }
        records.push(record)
        if (direction === 'import') {
          importAmount += amount
          importCount++
        } else {
          exportAmount += amount
          exportCount++
        }
        const key = route.country
        const p = partnerMap.get(key) || { amount: 0, count: 0 }
        p.amount += amount
        p.count++
        partnerMap.set(key, p)
      }
      monthly.push({
        month: monthStr,
        importAmount: Math.round(importAmount * 100) / 100,
        exportAmount: Math.round(exportAmount * 100) / 100,
        importCount,
        exportCount
      })
    }

    const totalImport = Math.round(monthly.reduce((s, m) => s + m.importAmount, 0) * 100) / 100
    const totalExport = Math.round(monthly.reduce((s, m) => s + m.exportAmount, 0) * 100) / 100
    const topPartners = [...partnerMap.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 5)
      .map(([c, v]) => ({ country: c, amount: Math.round(v.amount * 100) / 100, count: v.count }))

    records.sort((a, b) => b.date.localeCompare(a.date))

    return {
      source: 'demo',
      sourceLabel: SOURCE_LABEL.demo,
      note,
      updatedAt: new Date().toISOString(),
      website: host,
      company: {
        name: companyName,
        country,
        address: `${city} 自由贸易区 ${100 + (seed % 900)} 号`,
        founded: String(founded),
        employees,
        products
      },
      summary: {
        totalImport,
        totalExport,
        totalRecords: records.length,
        partnerCount: partnerMap.size,
        topPartners
      },
      monthly,
      records
    }
  }

  // 富通天下真实源（账号后补接入）
  private async fetchFutian(website: string, cfg: CustomsConfig): Promise<CustomsQueryResult> {
    this.logger.log(`富通天下查询 ${website}（账号：${cfg.futianUsername}）`)
    // TODO: 账号后补。接入富通天下登录 + 海关数据查询接口，返回与 demoQuery 相同结构。
    throw new Error('富通天下真实源接入待完善，请先使用演示数据')
  }
}
