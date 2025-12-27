import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { Contract } from '../contracts/entities/contract.entity';
import { ContractAssignee } from '../contracts/assignees/entities/assignee.entity';
import { Team } from '../dashboard/accounts/entities/team.entity';
import { TeamMember } from '../dashboard/accounts/entities/team-member.entity';
import { Account } from '../dashboard/accounts/entities/account.entity';
import { AccountCredential } from '../dashboard/accounts/entities/account-credential.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      ContractAssignee,
      Team,
      TeamMember,
      Account,
      AccountCredential,
    ]),
  ],
  controllers: [PerformanceController],
  providers: [PerformanceService],
})
export class PerformanceModule {}
