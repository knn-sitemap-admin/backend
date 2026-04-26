import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import { PinPhoto } from '../pin-photos/entities/pin-photo.entity';
import { ContractFile } from '../../contracts/files/entities/file.entity';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PinPhoto, ContractFile]),
    UploadModule,
  ],
  controllers: [MigrationController],
  providers: [MigrationService],
})
export class MigrationModule {}
