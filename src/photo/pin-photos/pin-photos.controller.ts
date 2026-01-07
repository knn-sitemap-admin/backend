import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PinPhotosService } from './pin-photos.service';
import { CreatePinPhotoDto } from './dto/create-pin-photo.dto';
import { UpdatePinPhotoDto } from './dto/update-pin-photo.dto';

@Controller('photos')
export class PinPhotosController {
  constructor(private readonly service: PinPhotosService) {}

  @Get(':groupId')
  async list(@Param('groupId') groupId: string) {
    return { data: await this.service.findByGroup(groupId) };
  }

  @Post(':groupId')
  async add(@Param('groupId') groupId: string, @Body() dto: CreatePinPhotoDto) {
    return {
      message: '사진 등록됨',
      data: await this.service.add(groupId, dto),
    };
  }

  @Patch()
  async update(@Body() dto: UpdatePinPhotoDto) {
    return { message: '사진 수정됨', data: await this.service.update(dto) };
  }

  @Delete()
  async remove(@Body('photoIds') photoIds: string[]) {
    return {
      message: '사진 삭제됨',
      data: await this.service.remove(photoIds),
    };
  }
}
