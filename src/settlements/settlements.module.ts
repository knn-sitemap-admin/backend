import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settlement } from './entities/settlement.entity';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
import { Account } from '../dashboard/accounts/entities/account.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { ContractAssignee } from '../contracts/assignees/entities/assignee.entity';
import { Ledger } from '../ledgers/entities/ledgers.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settlement, Account, Contract, ContractAssignee, Ledger]),
  ],
  providers: [SettlementsService],
  controllers: [SettlementsController],
  exports: [SettlementsService],
})
export class SettlementsModule {}
