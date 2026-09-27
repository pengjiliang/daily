import { Controller, Get, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { Product } from '../../entities/product.entity'
import { Lead } from '../../entities/lead.entity'
import { Campaign } from '../../entities/campaign.entity'

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>
  ) {}

  @Get()
  async overview() {
    const from = new Date(Date.now() - 6 * 864e5)
    const [productCount, leadCount, campaignCount, sentRaw, whatsappCount, sourceDist, categoryDist, regionDist, trend] =
      await Promise.all([
        this.products.count(),
        this.leads.count(),
        this.campaigns.count(),
        this.campaigns.createQueryBuilder('c').select('COALESCE(SUM(c.count), 0)', 's').getRawOne(),
        this.leads.count({ where: { hasWhatsApp: true } }),
        this.leads
          .createQueryBuilder('l')
          .select('l.source', 'name')
          .addSelect('COUNT(*)', 'value')
          .where("l.source <> ''")
          .groupBy('l.source')
          .orderBy('value', 'DESC')
          .getRawMany(),
        this.products
          .createQueryBuilder('p')
          .select('p."categoryLabel"', 'name')
          .addSelect('COUNT(*)', 'value')
          .where("p.\"categoryLabel\" <> ''")
          .groupBy('p."categoryLabel"')
          .orderBy('value', 'DESC')
          .getRawMany(),
        this.leads
          .createQueryBuilder('l')
          .select('l.region', 'name')
          .addSelect('COUNT(*)', 'value')
          .where("l.region <> ''")
          .groupBy('l.region')
          .orderBy('value', 'DESC')
          .limit(8)
          .getRawMany(),
        this.leads
          .createQueryBuilder('l')
          .select("to_char(l.\"createdAt\", 'YYYY-MM-DD')", 'date')
          .addSelect('COUNT(*)', 'value')
          .where('l."createdAt" >= :from', { from })
          .groupBy('date')
          .orderBy('date', 'ASC')
          .getRawMany()
      ])

    const byDate = Object.fromEntries((trend || []).map((t) => [t.date, Number(t.value)]))
    const dates: string[] = []
    const values: number[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(from.getTime() + i * 864e5)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      dates.push(key)
      values.push(byDate[key] || 0)
    }

    const toDist = (rows: { name?: string; value?: string }[]) =>
      (rows || []).map((r) => ({ name: r.name || '未知', value: Number(r.value) || 0 }))

    return {
      counts: { products: productCount, leads: leadCount, campaigns: campaignCount, messages: Number(sentRaw?.s) || 0 },
      whatsappRate: leadCount ? Math.round((whatsappCount / leadCount) * 100) : 0,
      whatsappCount,
      sourceDist: toDist(sourceDist),
      categoryDist: toDist(categoryDist),
      regionDist: toDist(regionDist),
      trend7d: { dates, values }
    }
  }
}
