import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { ContactMessage } from '../../entities/contact-message.entity'

@Controller('contact')
export class ContactController {
  constructor(@InjectRepository(ContactMessage) private messages: Repository<ContactMessage>) {}

  @Post('messages')
  async create(@Body() body: { name?: string; phone?: string; message?: string }) {
    const name = String(body.name || '').trim().slice(0, 100)
    const phone = String(body.phone || '').trim().slice(0, 50)
    const message = String(body.message || '').trim()
    if (!message) throw new BadRequestException('请填写留言内容')
    if (message.length > 5000) throw new BadRequestException('留言内容不能超过 5000 字')

    return this.messages.save({ name, phone, message, source: 'website' })
  }

  @Get('messages')
  @UseGuards(JwtAuthGuard)
  list() {
    return this.messages.find({ order: { id: 'DESC' }, take: 500 })
  }

  @Delete('messages/:id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    const item = await this.messages.findOne({ where: { id: Number(id) } })
    if (!item) throw new BadRequestException('留言不存在')
    await this.messages.remove(item)
    return { success: true }
  }
}