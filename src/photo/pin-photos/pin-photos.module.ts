import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinPhotosService } from './pin-photos.service';
import { PinPhotosController } from './pin-photos.controller';
import { PinPhoto } from './entities/pin-photo.entity';
import { PinPhotoGroup } from '../pin-photo-groups/entities/pin-photo-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PinPhoto, PinPhotoGroup])],
  controllers: [PinPhotosController],
  providers: [PinPhotosService],
  exports: [PinPhotosService],
})
export class PinPhotosModule {}
