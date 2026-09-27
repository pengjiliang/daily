import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { ContactMessage } from '../../entities/contact-message.entity'
import { ContactController } from './contact.controller'

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage]), AuthModule],
  controllers: [ContactController]
})
export class ContactModule {}