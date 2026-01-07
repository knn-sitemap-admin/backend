import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountCredential } from '../../dashboard/accounts/entities/account-credential.entity';
import { Account } from '../../dashboard/accounts/entities/account.entity';
import { ApiRequestLog } from '../logs/entities/api-request-log.entity';

import { OwnerEmployeeApiCountsService } from './owner-employee-api-counts.service';
import { OwnerEmployeeApiCountsController } from './owner-employee-api-counts.controller';

import { AuthModule } from '../../dashboard/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountCredential, Account, ApiRequestLog]),
    AuthModule,
  ],
  controllers: [OwnerEmployeeApiCountsController],
  providers: [OwnerEmployeeApiCountsService],
})
export class OwnerStatsModule {}
