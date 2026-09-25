import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { User } from '../../entities/user.entity'

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    @InjectRepository(User) private users: Repository<User>
  ) {}

  private hash(password: string): string {
    const salt = randomBytes(16).toString('hex')
    const hash = scryptSync(password, salt, 32).toString('hex')
    return `${salt}:${hash}`
  }

  private verify(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':')
    const calc = scryptSync(password, salt, 32)
    return timingSafeEqual(Buffer.from(hash, 'hex'), calc)
  }

  async register(username: string, password: string) {
    if (!username || !password) throw new UnauthorizedException('用户名和密码不能为空')
    const exists = await this.users.findOne({ where: { username } })
    if (exists) throw new ConflictException('该账号已存在，请直接登录')
    const user = await this.users.save({
      username,
      passwordHash: this.hash(password),
      createdAt: new Date().toISOString()
    })
    return { token: this.sign(user.username), username: user.username }
  }

  async login(username: string, password: string) {
    const user = await this.users.findOne({ where: { username } })
    if (!user || !this.verify(password, user.passwordHash)) {
      throw new UnauthorizedException('账号或密码错误')
    }
    return { token: this.sign(user.username), username: user.username }
  }

  me(username: string) {
    return { username, role: 'admin' }
  }

  private sign(username: string) {
    return this.jwt.sign({ username, role: 'admin' })
  }
}
