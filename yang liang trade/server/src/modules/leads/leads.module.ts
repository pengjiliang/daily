import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { Lead } from '../../entities/lead.entity'
import { Campaign } from '../../entities/campaign.entity'
import { LeadsController } from './leads.controller'
import { GooglePlacesService } from './google-places.service'

@Module({
  imports: [TypeOrmModule.forFeature([Lead, Campaign]), AuthModule],
  controllers: [LeadsController],
  providers: [GooglePlacesService],
  exports: [TypeOrmModule]
})
export class LeadsModule {}
