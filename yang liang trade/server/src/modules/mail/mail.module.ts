import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { MailAccount } from '../../entities/mail-account.entity'
import { Campaign } from '../../entities/campaign.entity'
import { MailController } from './mail.controller'
import { MailService } from './mail.service'

@Module({
  imports: [TypeOrmModule.forFeature([MailAccount, Campaign]), AuthModule],
  controllers: [MailController],
  providers: [MailService]
})
export class MailModule {}
