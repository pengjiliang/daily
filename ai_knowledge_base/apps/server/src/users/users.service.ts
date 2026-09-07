import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity.js';

export type CreateUserInput = Pick<User, 'username' | 'password'> &
  Partial<Pick<User, 'avatarUrl'>>;

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

  findOneById(id: number): Promise<User | null> {
    const numericId = Number(id);
    this.logger.log('Looking for user with id: ' + numericId + ', original type: ' + typeof id + ', converted type: ' + typeof numericId);
    return this.usersRepository.findOneBy({ id: numericId });
  }

  findOneByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username });
  }

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

  async remove(id: number): Promise<void> {
    const numericId = Number(id);
    const user = await this.findOneById(numericId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.remove(user);
  }
}