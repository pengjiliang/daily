import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { Product } from '../../entities/product.entity'
import { AlibabaService, AlibabaPreviewItem, CATEGORY_LABELS } from './alibaba.service'

interface ImportItemDto {
  name: string
  nameEn: string
  image: string
  spec: string
  desc: string
  features: string[]
  subCategory?: string
  category?: string
  categoryLabel?: string
  hasLogo?: boolean
}

// 取店铺网址的域名根（去掉协议/路径），用于记录产品来源店铺
function originOf(url?: string): string {
  if (!url) return ''
  try {
    return new URL(url).origin
  } catch {
    return String(url).trim()
  }
}

@Controller('alibaba')
@UseGuards(JwtAuthGuard)
export class AlibabaController {
  constructor(
    private alibaba: AlibabaService,
    @InjectRepository(Product) private products: Repository<Product>
  ) {}

  // 抓取店铺产品页，返回预览（不入库）
  @Post('preview')
  async preview(@Body() body: { url?: string; limit?: number; category?: string }) {
    if (!body.url || !/^https?:\/\//.test(body.url)) {
      throw new BadRequestException('请输入合法的 Alibaba 店铺产品页 URL')
    }
    const limit = Math.min(Number(body.limit) || 100, 500)
    const items = await this.alibaba.scrapeProducts(body.url, limit)
    const auto = !body.category || body.category === 'all' || body.category === 'auto'
    const items2 = items.map((it) => {
      if (auto) {
        // 全部：按名称自动识别每个产品的大类与细类
        const cat = this.alibaba.inferCategory(it.name || it.nameEn)
        return {
          ...it,
          category: cat.key,
          categoryLabel: cat.label,
          subCategory: this.alibaba.inferSubCategory(cat.key, it.name || it.nameEn)
        }
      }
      return {
        ...it,
        category: body.category,
        categoryLabel: CATEGORY_LABELS[body.category as string] || '',
        subCategory: this.alibaba.inferSubCategory(body.category as string, it.name || it.nameEn)
      }
    })
    return { count: items2.length, items: items2 }
  }

  // 批量导入选中的产品到产品库
  @Post('import')
  async importItems(@Body() body: { items?: ImportItemDto[]; category?: string; categoryLabel?: string; subCategory?: string; shopUrl?: string }) {
    if (!body.category) {
      throw new BadRequestException('请选择导入分类')
    }
    const auto = body.category === 'all' || body.category === 'auto'
    const raw = (body.items || []).filter((it) => it && (it.name || it.nameEn))
    // 含其他公司 logo 的产品（预览中勾选「含 Logo」）不上传
    const skipped = raw.filter((it) => it.hasLogo === true)
    const list = raw
      .filter((it) => it.hasLogo !== true)
      .map((it) => {
        // 自动分类：优先采用预览时已识别的大类，缺失时按名称重新识别
        let catKey = body.category as string
        let catLabel = body.categoryLabel as string
        if (auto) {
          const known = it.category && CATEGORY_LABELS[it.category]
          const cat = known
            ? { key: it.category as string, label: CATEGORY_LABELS[it.category as string] }
            : this.alibaba.inferCategory(it.name || it.nameEn)
          catKey = cat.key
          catLabel = cat.label
        }
        return {
          name: it.name || it.nameEn,
          nameEn: it.nameEn || '',
          category: catKey,
          categoryLabel: catLabel,
          subCategory: (it.subCategory || body.subCategory || this.alibaba.inferSubCategory(catKey, it.name || it.nameEn) || '').trim(),
          spec: it.spec || '',
          desc: it.desc || '',
          features: it.features || [],
          image: it.image || '/images/placeholder.svg',
          shopUrl: originOf(body.shopUrl)
        }
      })
    if (!list.length) {
      if (skipped.length) return { count: 0, skipped: skipped.length }
      throw new BadRequestException('没有可导入的产品')
    }
    const saved = await this.products.save(list as Product[])
    return { count: saved.length, skipped: skipped.length }
  }
}
