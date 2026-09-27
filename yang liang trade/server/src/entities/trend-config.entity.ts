import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('trend_configs')
export class TrendConfig {
  @PrimaryGeneratedColumn()
  id: number

  // 数据源模式：trends=Google Trends 实时（方案1）| ads=Google Ads API（方案2）| demo=演示数据
  @Column({ default: 'trends' })
  mode: string

  // HTTP 代理地址（如 Clash Verge http://127.0.0.1:7890），中国大陆访问 Google 时使用，留空走直连
  @Column({ default: '' })
  proxyUrl: string

  // Google Trends 地区代码（如 US / SG / MY），留空为全球
  @Column({ default: '' })
  geo: string

  // Google Ads API 配置（方案2）
  @Column({ default: '' })
  adsDeveloperToken: string

  @Column({ default: '' })
  adsClientId: string

  @Column({ default: '' })
  adsClientSecret: string

  @Column({ default: '' })
  adsRefreshToken: string

  @Column({ default: '' })
  adsCustomerId: string
}
