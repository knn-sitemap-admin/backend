import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

import { Contract } from './entities/contract.entity';

import { Account } from '../dashboard/accounts/entities/account.entity';
import { AccountCredential } from '../dashboard/accounts/entities/account-credential.entity';
import { TeamMember } from '../dashboard/accounts/entities/team-member.entity';
import { ContractAssignee } from './assignees/entities/assignee.entity';
import { ContractFile } from './files/entities/file.entity';
import { UploadModule } from '../photo/upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      ContractAssignee,
      ContractFile,
      Account,
      AccountCredential,
      TeamMember,
    ]),
    UploadModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
