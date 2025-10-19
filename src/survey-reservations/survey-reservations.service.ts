import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinDraft } from './entities/pin-draft.entity';
import { DataSource } from 'typeorm';
import { SurveyReservation } from './entities/survey-reservation.entity';
import { CreateSurveyReservationDto } from './dto/create-survey-reservation.dto';

@Injectable()
export class SurveyReservationsService {
  constructor(private readonly dataSource: DataSource) {}

  // 공통 메서드
  private async resolveMyAccountId(credId: string): Promise<string> {
    // 가장 안전한 방법: raw 또는 Account repo 사용
    const row = await this.dataSource.query(
      'SELECT id FROM accounts WHERE credential_id = ? LIMIT 1',
      [credId],
    );
    if (!row?.[0]?.id) {
      throw new NotFoundException('연결된 계정(Account)을 찾을 수 없습니다.');
    }
    return String(row[0].id);
  }

  async listBefore() {
    const rows = await this.dataSource
      .getRepository(PinDraft)
      .createQueryBuilder('d')
      .where('d.isActive = 1')
      .andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from(SurveyReservation, 'r')
          .where('r.pin_draft_id = d.id')
          .andWhere('r.is_deleted = 0')
          .getQuery();
        return `NOT EXISTS (${sub})`;
      })
      .orderBy('d.createdAt', 'DESC')
      .getMany();

    return rows;
  }

  async create(meCredentialId: string, dto: CreateSurveyReservationDto) {
    return this.dataSource.transaction(async (m) => {
      const myAccountId = await this.resolveMyAccountId(meCredentialId);

      // 1) 활성 draft 확인
      const draft = await m.getRepository(PinDraft).findOne({
        where: { id: String(dto.pinDraftId) as any, isActive: true as any },
      });
      if (!draft)
        throw new NotFoundException('활성 임시핀을 찾을 수 없습니다.');

      // 2) 중복 예약 방지
      const dup = await m
        .getRepository(SurveyReservation)
        .createQueryBuilder('r')
        .where('r.pin_draft_id = :pid', { pid: dto.pinDraftId })
        .andWhere('r.is_deleted = 0')
        .getExists();
      if (dup) throw new BadRequestException('이미 등록된 예약이 있습니다.');

      const insert = await m.getRepository(SurveyReservation).insert({
        pinDraft: { id: String(dto.pinDraftId) } as any,
        assignee: { id: myAccountId } as any,
        reservedDate: dto.reservedDate,
        isDeleted: false,
      });

      const id = insert.identifiers?.[0]?.id ?? null;
      return { id: String(id) };
    });
  }

  // 내 답사예정
  async listScheduled(meCredentialId: string) {
    const myAccountId = await this.resolveMyAccountId(meCredentialId);

    const qb = this.dataSource
      .getRepository(PinDraft)
      .createQueryBuilder('d')
      .addSelect((sq) => {
        return sq
          .select(
            'DATE_FORMAT(MIN(r.reserved_date), "%Y-%m-%d")',
            'minReservedDate',
          )
          .from(SurveyReservation, 'r')
          .where('r.pin_draft_id = d.id')
          .andWhere('r.is_deleted = 0')
          .andWhere('r.assignee_id = :me', { me: myAccountId });
      }, 'minReservedDate')
      .addSelect((sq) => {
        return sq
          .select('r2.id', 'minReservationId')
          .from(SurveyReservation, 'r2')
          .where('r2.pin_draft_id = d.id')
          .andWhere('r2.is_deleted = 0')
          .andWhere('r2.assignee_id = :me', { me: myAccountId })
          .orderBy('r2.reserved_date', 'ASC')
          .addOrderBy('r2.id', 'ASC')
          .limit(1);
      }, 'minReservationId')
      .where('d.isActive = 1')
      .andWhere(
        `EXISTS (
        SELECT 1 FROM survey_reservations r
        WHERE r.pin_draft_id = d.id
          AND r.is_deleted = 0
          AND r.assignee_id = :me
      )`,
        { me: myAccountId },
      )
      .orderBy('minReservedDate IS NULL', 'ASC')
      .addOrderBy('minReservedDate', 'ASC')
      .addOrderBy('d.createdAt', 'DESC');

    const { entities, raw } = await qb.getRawAndEntities();

    return entities.map((e, i) => ({
      id: raw[i]?.minReservationId ? String(raw[i].minReservationId) : null, // 예약 PK
      pin_draft_id: Number(e.id),
      lat: Number(e.lat),
      lng: Number(e.lng),
      addressLine: e.addressLine,
      reservedDate: raw[i]?.minReservedDate ?? null,
      isActive: e.isActive,
      createdAt: e.createdAt,
    }));
  }

  async cancel(id: number, meCredentialId: string) {
    return this.dataSource.transaction(async (m) => {
      const myAccountId = await this.resolveMyAccountId(meCredentialId);
      const surveyReservationRepo = m.getRepository(SurveyReservation);

      const found = await surveyReservationRepo
        .createQueryBuilder('r')
        .select([
          'r.id AS id',
          'r.pin_draft_id AS pinDraftId', //피드백 반영
          'r.assignee_id AS assigneeId',
          'r.is_deleted AS isDeleted',
        ])
        .where('r.id = :id', { id })
        .getRawOne<{
          id: string;
          pinDraftId: string;
          assigneeId: string;
          isDeleted: number;
        }>();

      if (!found) throw new NotFoundException('예약을 찾을 수 없습니다.');
      if (String(found.assigneeId) !== String(myAccountId)) {
        throw new ForbiddenException('내 예약만 취소할 수 있습니다.');
      }
      if (found.isDeleted) {
        return {
          id: Number(found.id),
          pin_draft_id: Number(found.pinDraftId),
          alreadyCanceled: true,
        };
      }

      await surveyReservationRepo
        .createQueryBuilder()
        .update()
        .set({ isDeleted: true, deletedAt: () => 'CURRENT_TIMESTAMP' })
        .where('id = :id', { id })
        .execute();

      return {
        reservationId: id,
        pin_draft_id: Number(found.pinDraftId),
        alreadyCanceled: false,
      };
    });
  }
}
