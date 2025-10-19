import { forwardRef, Module } from '@nestjs/common';
import { ContractFilesController } from './files.controller';
import { ContractFile } from './entities/file.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../entities/contract.entity';
import { ContractsModule } from '../contracts.module';
import { ContractFilesService } from './files.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContractFile, Contract])],
  controllers: [ContractFilesController],
  providers: [ContractFilesService],
  exports: [ContractFilesService],
})
export class FilesModule {}
