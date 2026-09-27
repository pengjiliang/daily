import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { Product } from '../../entities/product.entity'
import { TrendConfig } from '../../entities/trend-config.entity'
import { TrendsController } from './trends.controller'
import { TrendsService } from './trends.service'

@Module({
  imports: [TypeOrmModule.forFeature([Product, TrendConfig]), AuthModule],
  controllers: [TrendsController],
  providers: [TrendsService]
})
export class TrendsModule {}
