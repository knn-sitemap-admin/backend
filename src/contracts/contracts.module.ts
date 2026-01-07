import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

import { Contract } from './entities/contract.entity';

import { Account } from '../dashboard/accounts/entities/account.entity';
import { ContractAssignee } from './assignees/entities/assignee.entity';
import { ContractFile } from './files/entities/file.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      ContractAssignee,
      ContractFile,
      Account,
    ]),
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
