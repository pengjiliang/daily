import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { Product } from '../../entities/product.entity'
import { Lead } from '../../entities/lead.entity'
import { Campaign } from '../../entities/campaign.entity'
import { DashboardController } from './dashboard.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Product, Lead, Campaign]), AuthModule],
  controllers: [DashboardController]
})
export class DashboardModule {}
