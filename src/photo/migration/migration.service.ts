import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinPhoto } from '../pin-photos/entities/pin-photo.entity';
import { ContractFile } from '../../contracts/files/entities/file.entity';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectRepository(PinPhoto)
    private readonly pinPhotoRepo: Repository<PinPhoto>,
    @InjectRepository(ContractFile)
    private readonly contractFileRepo: Repository<ContractFile>,
    private readonly uploadService: UploadService,
  ) {}

  async migrateS3UrlsToKeys() {
    this.logger.log('Starting S3 URL to Key migration...');
    
    let pinPhotoCount = 0;
    let contractFileCount = 0;

    // 1. PinPhotos 처리
    const pinPhotos = await this.pinPhotoRepo.find();
    for (const photo of pinPhotos) {
      const key = this.uploadService.extractKeyFromUrl(photo.url);
      if (key && key !== photo.url) {
        await this.pinPhotoRepo.update(photo.id, { url: key });
        pinPhotoCount++;
      }
    }

    // 2. ContractFiles 처리
    const contractFiles = await this.contractFileRepo.find();
    for (const file of contractFiles) {
      const key = this.uploadService.extractKeyFromUrl(file.url);
      if (key && key !== file.url) {
        await this.contractFileRepo.update(file.id, { url: key });
        contractFileCount++;
      }
    }

    this.logger.log(`Migration finished. Updated ${pinPhotoCount} pin photos and ${contractFileCount} contract files.`);
    
    return {
      success: true,
      updatedPinPhotos: pinPhotoCount,
      updatedContractFiles: contractFileCount,
    };
  }
}
