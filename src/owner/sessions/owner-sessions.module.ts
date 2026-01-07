import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountCredential } from '../../dashboard/accounts/entities/account-credential.entity';
import { Account } from '../../dashboard/accounts/entities/account.entity';
import { AccountSession } from '../../dashboard/auth/entities/account-session.entity';

import { OwnerEmployeeSessionsService } from './owner-employee-sessions.service';
import { OwnerEmployeeSessionsController } from './owner-employee-sessions.controller';
import { OwnerSessionsService } from '../owner-sessions.service';
import { sessionStoreProvider } from '../../common/session-store/session-store.provider';

import { AuthModule } from '../../dashboard/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountCredential, Account, AccountSession]),
    AuthModule,
  ],
  controllers: [OwnerEmployeeSessionsController],
  providers: [
    OwnerEmployeeSessionsService,
    OwnerSessionsService,
    sessionStoreProvider,
  ],
})
export class OwnerSessionsModule {}
