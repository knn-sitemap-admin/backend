import { Module } from '@nestjs/common';
import { ContractAssigneesController } from './assignees.controller';
import { ContractAssigneesService } from './assignees.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractAssignee } from './entities/assignee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContractAssignee])],
  controllers: [ContractAssigneesController],
  providers: [ContractAssigneesService],
  exports: [ContractAssigneesService],
})
export class AssigneesModule {}
