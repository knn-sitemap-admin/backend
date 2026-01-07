import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PinPhotoGroupsService } from './pin-photo-groups.service';
import { CreatePinPhotoGroupDto } from './dto/create-pin-photo-group.dto';
import { UpdatePinPhotoGroupDto } from './dto/update-pin-photo-group.dto';

@Controller('photo-groups')
export class PinPhotoGroupsController {
  constructor(private readonly service: PinPhotoGroupsService) {}

  @Get(':pinId')
  async findByPin(@Param('pinId') pinId: string) {
    return { data: await this.service.findByPin(pinId) };
  }

  @Post()
  async create(@Body() dto: CreatePinPhotoGroupDto) {
    return {
      message: '사진 그룹 생성됨',
      data: await this.service.create(dto),
    };
  }

  @Patch(':groupId')
  async update(
    @Param('groupId') groupId: string,
    @Body() dto: UpdatePinPhotoGroupDto,
  ) {
    return {
      message: '사진 그룹 수정됨',
      data: await this.service.update(groupId, dto),
    };
  }
}
