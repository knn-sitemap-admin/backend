import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinPhoto } from './entities/pin-photo.entity';
import { In, Repository } from 'typeorm';
import { CreatePinPhotoDto } from './dto/create-pin-photo.dto';
import { UpdatePinPhotoDto } from './dto/update-pin-photo.dto';

@Injectable()
export class PinPhotosService {
  constructor(
    @InjectRepository(PinPhoto)
    private readonly repo: Repository<PinPhoto>,
  ) {}

  findByGroup(groupId: string) {
    return this.repo.find({ where: { groupId }, order: { sortOrder: 'ASC' } });
  }

  async add(groupId: string, dto: CreatePinPhotoDto) {
    const rows = dto.urls.map((url, idx) =>
      this.repo.create({
        groupId,
        url,
        isCover: dto.isCover ?? false,
        sortOrder: dto.sortOrders?.[idx] ?? idx,
      }),
    );
    return await this.repo.save(rows);
  }

  async update(dto: UpdatePinPhotoDto) {
    await Promise.all(
      dto.photoIds.map((id) =>
        this.repo.update(id, {
          isCover: dto.isCover,
          sortOrder: dto.sortOrder,
          groupId: dto.moveGroupId, // id 타입 수정 필요
        }),
      ),
    );
    return await this.repo.findBy({ id: In(dto.photoIds) });
  }

  async remove(photoIds: string[]) {
    const result = await this.repo.delete(photoIds);
    return { affected: result.affected ?? 0 };
  }
}
