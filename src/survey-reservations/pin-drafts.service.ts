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
    try {
      if (!Number.isFinite(dto.lat) || !Number.isFinite(dto.lng)) {
        throw new BadRequestException('잘못된 좌표');
      }

      const lat = Number(dto.lat.toFixed(7));
      const lng = Number(dto.lng.toFixed(7));

      const creatorAccountId = meCredentialId
        ? await this.resolveMyAccountId(meCredentialId)
        : null;

      const repo = this.ds.getRepository(PinDraft);
      const draft = repo.create({
        lat: String(lat),
        lng: String(lng),
        addressLine: dto.addressLine,
        name: dto.name ?? null,
        contactMainPhone: dto.contactMainPhone ?? null,
        contactSubPhone: dto.contactSubPhone ?? null,
        isActive: true,
        creatorId: creatorAccountId,
      });

      await repo.save(draft);

      return { draftId: draft.id };
    } catch (err: any) {
      console.error('[PinDraftsService.create] ERROR');
      console.error('meCredentialId:', meCredentialId);
      console.error('dto:', dto);

      // 변환값까지 확인
      try {
        const lat = Number.isFinite(dto?.lat)
          ? Number(dto.lat.toFixed(7))
          : dto?.lat;
        const lng = Number.isFinite(dto?.lng)
          ? Number(dto.lng.toFixed(7))
          : dto?.lng;
        console.error('latFixed7:', lat, 'lngFixed7:', lng);
      } catch (e) {
        console.error('lat/lng toFixed failed:', e);
      }

      console.error('err.name:', err?.name);
      console.error('err.message:', err?.message);
      if (err?.stack) console.error(err.stack);

      // TypeORM QueryFailedError가 보통 여기로 들어옴
      console.error('err.query:', err?.query);
      console.error('err.parameters:', err?.parameters);

      const d = err?.driverError;
      if (d) {
        console.error('driverError.code:', d.code);
        console.error('driverError.errno:', d.errno);
        console.error('driverError.sqlState:', d.sqlState);
        console.error('driverError.sqlMessage:', d.sqlMessage);
      }

      throw err;
    }
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
