import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { Product } from '../../entities/product.entity'

export class ProductDto {
  name: string
  nameEn: string
  category: string
  categoryLabel: string
  spec: string
  desc: string
  features?: string[]
  image?: string
}

@Controller('products')
export class ProductsController {
  constructor(@InjectRepository(Product) private products: Repository<Product>) {}

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
}
