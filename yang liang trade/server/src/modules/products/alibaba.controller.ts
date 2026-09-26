import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { Product } from '../../entities/product.entity'
import { AlibabaService, AlibabaPreviewItem } from './alibaba.service'

interface ImportItemDto {
  name: string
  nameEn: string
  image: string
  spec: string
  desc: string
  features: string[]
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
  async preview(@Body() body: { url?: string; limit?: number }) {
    if (!body.url || !/^https?:\/\//.test(body.url)) {
      throw new BadRequestException('请输入合法的 Alibaba 店铺产品页 URL')
    }
    const limit = Math.min(Number(body.limit) || 100, 500)
    const items = await this.alibaba.scrapeProducts(body.url, limit)
    return { count: items.length, items }
  }

  // 批量导入选中的产品到产品库
  @Post('import')
  async importItems(@Body() body: { items?: ImportItemDto[]; category?: string; categoryLabel?: string }) {
    if (!body.category || !body.categoryLabel) {
      throw new BadRequestException('请选择导入分类')
    }
    const list = (body.items || [])
      .filter((it) => it && (it.name || it.nameEn))
      .map((it) => ({
        name: it.name || it.nameEn,
        nameEn: it.nameEn || '',
        category: body.category as string,
        categoryLabel: body.categoryLabel as string,
        spec: it.spec || '',
        desc: it.desc || '',
        features: it.features || [],
        image: it.image || '/images/placeholder.svg'
      }))
    if (!list.length) throw new BadRequestException('没有可导入的产品')
    const saved = await this.products.save(list as Product[])
    return { count: saved.length }
  }
}
