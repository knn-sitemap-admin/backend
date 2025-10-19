import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreatePinDraftDto } from './dto/create-pin-draft.dto';
import { PinDraft } from './entities/pin-draft.entity';

@Injectable()
export class PinDraftsService {
  constructor(private readonly ds: DataSource) {}

  async create(dto: CreatePinDraftDto) {
    if (!Number.isFinite(dto.lat) || !Number.isFinite(dto.lng)) {
      throw new BadRequestException('잘못된 좌표');
    }

    const repo = this.ds.getRepository(PinDraft);
    const draft = repo.create({
      lat: String(dto.lat),
      lng: String(dto.lng),
      addressLine: dto.addressLine,
      isActive: true,
    });
    await repo.save(draft);

    return { draftId: draft.id };
  }
}
