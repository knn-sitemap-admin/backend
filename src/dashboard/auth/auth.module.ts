import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountCredential } from '../accounts/entities/account-credential.entity';
import { BcryptModule } from '../../common/hashing/bcrypt.module';
import { Account } from '../accounts/entities/account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountCredential, Account]),
    BcryptModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
