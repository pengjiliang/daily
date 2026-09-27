import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { CustomsConfig } from '../../entities/customs-config.entity'
import { CustomsController } from './customs.controller'
import { CustomsService } from './customs.service'

@Module({
  imports: [TypeOrmModule.forFeature([CustomsConfig]), AuthModule],
  controllers: [CustomsController],
  providers: [CustomsService]
})
export class CustomsModule {}
