import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { AssigneesModule } from './assignees/assignees.module';
import { FilesModule } from './files/files.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { ContractFile } from './files/entities/file.entity';
import { ContractAssigneesService } from './assignees/assignees.service';
import { ContractAssignee } from './assignees/entities/assignee.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, ContractFile, ContractAssignee]),
    AssigneesModule,
    FilesModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService, ContractAssigneesService],
  exports: [ContractsService],
})
export class ContractsModule {}
