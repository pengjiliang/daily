/**
 * 用户服务：对 users 表的增查改删封装，供鉴权与上传模块调用。
 */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity.js';

/** 创建用户所需字段：用户名 + 密码哈希必填，头像可选 */
export type CreateUserInput = Pick<User, 'username' | 'password'> & Partial<Pick<User, 'avatarUrl'>>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  create(input: CreateUserInput): Promise<User> {
    return this.usersRepository.save(this.usersRepository.create(input));
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  /** 按主键查用户，不存在返回 null（保留了类型转换的调试日志） */
  findOneById(id: number): Promise<User | null> {
    const numericId = Number(id);
    this.logger.log(
      'Looking for user with id: ' +
        numericId +
        ', original type: ' +
        typeof id +
        ', converted type: ' +
        typeof numericId,
    );
    return this.usersRepository.findOneBy({ id: numericId });
  }

  /** 按用户名查用户（登录校验、注册重名检查使用），不存在返回 null */
  findOneByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username });
  }

  /** 局部更新用户（如更换头像）；用户不存在抛 404 */
  async update(id: number, input: Partial<CreateUserInput>): Promise<User> {
    const numericId = Number(id);
    this.logger.log('Updating user id: ' + id + ' (converted to ' + numericId + ')');
    const user = await this.findOneById(numericId);
    if (!user) {
      this.logger.error('User not found for id: ' + id + ' (converted to ' + numericId + ')');
      throw new NotFoundException('User not found');
    }
    Object.assign(user, input);
    return this.usersRepository.save(user);
  }

  /** 删除用户；不存在抛 404 */
  async remove(id: number): Promise<void> {
    const numericId = Number(id);
    const user = await this.findOneById(numericId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.remove(user);
  }
}
