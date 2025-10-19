import { PinPhotoGroup } from './entities/pin-photo-group.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdatePinPhotoGroupDto } from './dto/update-pin-photo-group.dto';
import { CreatePinPhotoGroupDto } from './dto/create-pin-photo-group.dto';

@Injectable()
export class PinPhotoGroupsService {
  constructor(
    @InjectRepository(PinPhotoGroup)
    private readonly repo: Repository<PinPhotoGroup>,
  ) {}

  findByPin(pinId: string) {
    return this.repo.find({ where: { pinId }, order: { sortOrder: 'ASC' } });
  }

  async create(dto: CreatePinPhotoGroupDto) {
    const group = this.repo.create(dto); //id 타입 불일치(bigint -> string) 수정 필요
    return await this.repo.save(group);
  }

  async update(groupId: string, dto: UpdatePinPhotoGroupDto) {
    await this.repo.update(groupId, dto);
    return await this.repo.findOneByOrFail({ id: groupId });
  }
}
