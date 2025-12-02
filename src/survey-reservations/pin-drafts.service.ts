import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreatePinDraftDto } from './dto/create-pin-draft.dto';
import { PinDraft } from './entities/pin-draft.entity';
import { PinDraftDetailDto } from './dto/pin-draft-detail.dto';
import { SurveyReservation } from './entities/survey-reservation.entity';

@Injectable()
export class PinDraftsService {
  constructor(private readonly ds: DataSource) {}

  private async resolveMyAccountId(credId: string): Promise<string | null> {
    if (!credId) return null;

    const row = await this.ds.query(
      'SELECT id FROM accounts WHERE credential_id = ? LIMIT 1',
      [credId],
    );
    if (!row?.[0]?.id) return null;
    return String(row[0].id);
  }

  async create(dto: CreatePinDraftDto, meCredentialId: string | null) {
    if (!Number.isFinite(dto.lat) || !Number.isFinite(dto.lng)) {
      throw new BadRequestException('잘못된 좌표');
    }

    const creatorAccountId = meCredentialId
      ? await this.resolveMyAccountId(meCredentialId)
      : null;

    const repo = this.ds.getRepository(PinDraft);
    const draft = repo.create({
      lat: String(dto.lat),
      lng: String(dto.lng),
      addressLine: dto.addressLine,
      name: dto.name ?? null,
      contactMainPhone: dto.contactMainPhone ?? null,
      isActive: true,
      creatorId: creatorAccountId,
    });

    await repo.save(draft);

    return { draftId: draft.id };
  }

  async findDraftDetail(id: string): Promise<PinDraftDetailDto> {
    const draftRepo = this.ds.getRepository(PinDraft);

    const draft = await draftRepo.findOne({
      where: { id: String(id), isActive: true },
    });

    if (!draft) {
      throw new NotFoundException('임시핀 없음');
    }

    return PinDraftDetailDto.fromEntity(draft);
  }

  async deleteDraftWithReservations(draftId: string) {
    const draftRepo = this.ds.getRepository(PinDraft);
    const resvRepo = this.ds.getRepository(SurveyReservation);

    // 1) 임시핀 존재 여부만 체크
    const draft = await draftRepo.findOne({
      where: { id: String(draftId) },
    });

    if (!draft) {
      throw new NotFoundException('임시핀을 찾을 수 없습니다.');
    }

    await resvRepo.delete({
      pinDraft: { id: draft.id },
    } as any);

    await draftRepo.delete(draft.id);

    return {
      deletedDraftId: String(draft.id),
    };
  }
}
