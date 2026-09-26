import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { ProductsController } from './products.controller'
import { AlibabaController } from './alibaba.controller'
import { AlibabaService } from './alibaba.service'
import { Product } from '../../entities/product.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Product]), AuthModule],
  controllers: [ProductsController, AlibabaController],
  providers: [AlibabaService],
  exports: [TypeOrmModule]
})
export class ProductsModule {}
