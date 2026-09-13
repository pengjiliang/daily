/**
 * 鉴权服务：用户注册（bcrypt 哈希密码）、登录（校验密码并签发 JWT）、查询个人资料。
 * 对外返回的用户对象统一剥离 password 字段（PublicUser）。
 */
import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

/** 对外暴露的用户类型：不含密码哈希 */
export type PublicUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** 注册：用户名唯一校验 + bcrypt（cost=12）哈希后入库 */
  async register(dto: RegisterDto): Promise<PublicUser> {
    const existingUser = await this.usersService.findOneByUsername(dto.username);
    if (existingUser) {
      throw new ConflictException('Username is already registered');
    }

    const password = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      username: dto.username,
      password,
    });

    return this.toPublicUser(user);
  }

  /** 登录：用户名或密码任一错误都返回统一的 401，避免泄露用户名是否存在 */
  async login(dto: LoginDto): Promise<{ access_token: string; user: PublicUser }> {
    const user = await this.usersService.findOneByUsername(dto.username);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // JWT payload：sub 为用户 ID（JwtStrategy 据此还原登录用户）
    const access_token = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
    });

    return { access_token, user: this.toPublicUser(user) };
  }

  /** 查询个人资料，用户不存在时返回 404 */
  async getProfile(userId: number): Promise<PublicUser> {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublicUser(user);
  }

  /** 剥离密码哈希等敏感字段，只返回可对外暴露的用户信息 */
  private toPublicUser(user: User): PublicUser {
    const { password: _password, ...publicUser } = user;
    return publicUser;
  }
}
