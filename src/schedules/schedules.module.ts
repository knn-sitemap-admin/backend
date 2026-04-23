import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from './entities/schedule.entity';
import { Account } from '../dashboard/accounts/entities/account.entity';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';

import { Contract } from '../contracts/entities/contract.entity';
import { ContractAssignee } from '../contracts/assignees/entities/assignee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, Account, Contract, ContractAssignee])],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
