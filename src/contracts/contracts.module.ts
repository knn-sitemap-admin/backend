import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { AssigneesModule } from './assignees/assignees.module';
import { FilesModule } from './files/files.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { ContractFile } from './files/entities/file.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, ContractFile]),
    AssigneesModule,
    FilesModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
