import { Module } from '@nestjs/common';
import { PinPhotoGroupsModule } from './pin-photo-groups/pin-photo-groups.module';
import { PinPhotosModule } from './pin-photos/pin-photos.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [PinPhotoGroupsModule, PinPhotosModule, UploadModule],
})
export class PhotoModule {}
