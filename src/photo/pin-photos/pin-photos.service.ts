import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinPhoto } from './entities/pin-photo.entity';
import { In, Repository } from 'typeorm';
import { CreatePinPhotoDto } from './dto/create-pin-photo.dto';
import { UpdatePinPhotoDto } from './dto/update-pin-photo.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class PinPhotosService {
  private readonly logger = new Logger(PinPhotosService.name);

  constructor(
    @InjectRepository(PinPhoto)
    private readonly repo: Repository<PinPhoto>,
    private readonly uploadService: UploadService,
  ) { }

  async findByGroup(groupId: string) {
    const photos = await this.repo.find({ where: { groupId }, order: { sortOrder: 'ASC' } });
    return photos.map(p => ({
      ...p,
      url: this.uploadService.getFileUrl(p.url),
    }));
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
    const saved = await this.repo.save(rows);
    return saved.map((p) => ({
      ...p,
      url: this.uploadService.getFileUrl(p.url),
    }));
  }

  async update(dto: UpdatePinPhotoDto) {
    await Promise.all(
      dto.photoIds.map((id) =>
        this.repo.update(id, {
          isCover: dto.isCover,
          sortOrder: dto.sortOrder,
          groupId: dto.moveGroupId,
        }),
      ),
    );
    const photos = await this.repo.findBy({ id: In(dto.photoIds) });
    return photos.map((p) => ({
      ...p,
      url: this.uploadService.getFileUrl(p.url),
    }));
  }

  async batchUpdate(patches: any[]) {
    // eslint-disable-next-line no-console

    const results = await Promise.allSettled(
      patches.map(async (p, i) => {
        const id = p.id;
        const dto = p.dto || p;
        const updateData: any = {};

        if (dto.caption !== undefined) updateData.caption = dto.caption;
        if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
        if (dto.groupId !== undefined) updateData.groupId = dto.groupId;
        if (dto.moveGroupId !== undefined) updateData.groupId = dto.moveGroupId;
        if (dto.isCover !== undefined) updateData.isCover = dto.isCover;

        if (Object.keys(updateData).length > 0) {
          // eslint-disable-next-line no-console
          const res = await this.repo
            .createQueryBuilder()
            .update(PinPhoto)
            .set(updateData)
            .where('id = :id', { id })
            .execute();

          if (res.affected === 0) {
            this.logger.warn(`[QB item#${i}] No row updated for ID:${id}`);
          }
          return res;
        }
      }),
    );

    // 3) 결과 통합 및 반환 (프론트엔드 assertArray 대응을 위해 배열로 반환)
    const updatedIds = patches.map((p) => p.id);
    const photos = await this.repo.find({
      where: { id: In(updatedIds) },
      order: { sortOrder: 'ASC' },
    });
    return photos.map(p => ({
      ...p,
      url: this.uploadService.getFileUrl(p.url),
    }));
  }

  async remove(photoIds: string[]) {
    // [ cleanup ] S3에서 파일 실제 삭제
    const photos = await this.repo.findBy({ id: In(photoIds) });
    if (photos.length > 0) {
      const urls = photos.map((p) => p.url).filter(Boolean);
      await this.uploadService.deleteFiles(urls);
    }

    const result = await this.repo.delete(photoIds);
    return { affected: result.affected ?? 0 };
  }
}
