import { Module } from '@nestjs/common'
import { AiConfigModule } from '../ai-config/ai-config.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({
  imports: [AiConfigModule],
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule {}
