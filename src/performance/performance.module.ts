import { Module } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';
import { Team } from '../dashboard/accounts/entities/team.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../contracts/entities/contract.entity';
import { ContractAssignee } from '../contracts/assignees/entities/assignee.entity';
import { Account } from '../dashboard/accounts/entities/account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, ContractAssignee, Account, Team]),
  ],
  controllers: [PerformanceController],
  providers: [PerformanceService],
})
export class PerformanceModule {}
