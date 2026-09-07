import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

export type PublicUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

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

  async login(dto: LoginDto): Promise<{ access_token: string; user: PublicUser }> {
    const user = await this.usersService.findOneByUsername(dto.username);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const access_token = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
    });

    return { access_token, user: this.toPublicUser(user) };
  }

  async getProfile(userId: number): Promise<PublicUser> {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublicUser(user);
  }

  private toPublicUser(user: User): PublicUser {
    const { password: _password, ...publicUser } = user;
    return publicUser;
  }
}
