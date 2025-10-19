import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinPhotoGroupsService } from './pin-photo-groups.service';
import { PinPhotoGroupsController } from './pin-photo-groups.controller';
import { PinPhotoGroup } from './entities/pin-photo-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PinPhotoGroup])],
  controllers: [PinPhotoGroupsController],
  providers: [PinPhotoGroupsService],
  exports: [PinPhotoGroupsService],
})
export class PinPhotoGroupsModule {}
