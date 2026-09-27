import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { Product } from '../../entities/product.entity'
import { AlibabaService } from './alibaba.service'
import { matchHotKeywords } from '../../common/hot-keywords'

export class ProductDto {
  name: string
  nameEn: string
  category: string
  categoryLabel: string
  subCategory?: string
  spec: string
  desc: string
  features?: string[]
  image?: string
}

@Controller('products')
export class ProductsController {
  constructor(
    @InjectRepository(Product) private products: Repository<Product>,
    private alibaba: AlibabaService
  ) {}

  @Get('featured')
  async featured(@Query('limit') limitValue?: string) {
    const limit = Math.min(12, Math.max(3, Math.floor(Number(limitValue) || 9)))
    const all = await this.products.find({ order: { id: 'ASC' } })
    const scored = all.map((p) => ({ p, hits: matchHotKeywords(p) }))
    scored.sort((a, b) => b.hits.length - a.hits.length || a.p.id - b.p.id)
    const groups = new Map<string, typeof scored>()
    for (const s of scored) {
      if (!groups.has(s.p.category)) groups.set(s.p.category, [])
      groups.get(s.p.category)!.push(s)
    }
    const keys = [...groups.keys()]
    const out: typeof scored = []
    let take = true
    while (out.length < limit && take) {
      take = false
      for (const k of keys) {
        if (out.length >= limit) break
        const item = groups.get(k)!.shift()
        if (item) {
          out.push(item)
          take = true
        }
      }
    }
    return out.map((s) => s.p)
  }

  @Get()
  async list() {
    return this.products.find({ order: { id: 'ASC' } })
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: ProductDto) {
    return this.products.save({
      name: dto.name,
      nameEn: dto.nameEn,
      category: dto.category,
      categoryLabel: dto.categoryLabel,
      subCategory: dto.subCategory || '',
      spec: dto.spec,
      desc: dto.desc,
      features: dto.features || [],
      image: dto.image || '/images/placeholder.svg'
    })
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() dto: Partial<ProductDto>) {
    const item = await this.products.findOne({ where: { id: Number(id) } })
    if (!item) return { error: '产品不存在' }
    Object.assign(item, dto)
    return this.products.save(item)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    const item = await this.products.findOne({ where: { id: Number(id) } })
    if (!item) return { error: '产品不存在' }
    await this.products.remove(item)
    return { success: true }
  }

  // 为已有产品（细类为空）按名称自动识别补全细类
  @Post('fill-subcategories')
  @UseGuards(JwtAuthGuard)
  async fillSubcategories() {
    const all = await this.products.find()
    const toSave: Product[] = []
    for (const p of all) {
      if (p.subCategory) continue
      const sub = this.alibaba.inferSubCategory(p.category, p.name + ' ' + p.nameEn)
      if (sub) {
        p.subCategory = sub
        toSave.push(p)
      }
    }
    if (toSave.length) await this.products.save(toSave)
    return { success: true, updated: toSave.length }
  }

  @Post('batch-delete')
  @UseGuards(JwtAuthGuard)
  async batchDelete(@Body() body: { ids?: number[] }) {
    const ids = (body.ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0)
    if (!ids.length) throw new BadRequestException('请选择要删除的产品')
    const items = await this.products.findBy({ id: In(ids) })
    await this.products.remove(items)
    return { success: true, count: items.length }
  }
}
