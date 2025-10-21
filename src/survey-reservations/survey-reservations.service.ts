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
import { ReorderSurveyReservationsDto } from './dto/reorder-survey-reservations.dto';

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

      // 활성 draft 확인
      const draft = await m.getRepository(PinDraft).findOne({
        where: { id: String(dto.pinDraftId), isActive: true },
      });
      if (!draft)
        throw new NotFoundException('활성 임시핀을 찾을 수 없습니다.');

      // 중복 예약 방지(해당 draft에 이미 예약 있으면 불가)
      const dup = await m
        .getRepository(SurveyReservation)
        .createQueryBuilder('r')
        .where('r.pin_draft_id = :pid', { pid: dto.pinDraftId })
        .andWhere('r.is_deleted = 0')
        .getExists();
      if (dup) throw new BadRequestException('이미 등록된 예약이 있습니다.');

      const surveyReservationRepo = m.getRepository(SurveyReservation);

      // 약들 잠금 후 정렬 계산
      const current = await surveyReservationRepo
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.assignee_id = :aid', { aid: myAccountId })
        .andWhere('r.is_deleted = 0')
        .orderBy('r.sort_order', 'ASC')
        .addOrderBy('r.id', 'ASC')
        .getMany();

      let sortOrder: number;

      if (typeof dto.insertAt === 'number') {
        // 3-1) 특정 위치에 삽입: insertAt 이상의 것들 +1 밀기
        const insertAt = Math.max(0, Math.min(dto.insertAt, current.length));
        // 밀기
        if (insertAt < current.length) {
          await surveyReservationRepo
            .createQueryBuilder()
            .update()
            .set({ sortOrder: () => 'sort_order + 1' })
            .where('assignee_id = :aid', { aid: myAccountId })
            .andWhere('is_deleted = 0')
            .andWhere('sort_order >= :insertAt', { insertAt })
            .execute();
        }
        sortOrder = insertAt;
      } else {
        const maxOrder = current.length
          ? current[current.length - 1].sortOrder
          : -1;
        sortOrder = maxOrder + 1;
      }

      // insert
      const insert = await surveyReservationRepo.insert({
        pinDraft: { id: String(dto.pinDraftId) },
        assignee: { id: myAccountId },
        reservedDate: dto.reservedDate,
        sortOrder,
        isDeleted: false,
      });

      const id = insert.identifiers?.[0]?.id ?? null;
      return { id: String(id), sortOrder };
    });
  }

  // 내 답사예정
  // survey-reservations.service.ts
  async listScheduled(meCredentialId: string) {
    const myAccountId = await this.resolveMyAccountId(meCredentialId);

    const rows = await this.dataSource
      .getRepository(SurveyReservation)
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.pinDraft', 'd')
      .where('r.assignee_id = :me', { me: myAccountId })
      .andWhere('r.is_deleted = 0')
      .orderBy('r.sort_order', 'ASC') // ← 사용자별 순서 1순위
      .addOrderBy('r.reserved_date', 'ASC') // ← 보조
      .addOrderBy('r.id', 'ASC') // ← 보조
      .getMany();

    return rows.map((r) => ({
      id: Number(r.id),
      pin_draft_id: Number(r.pinDraft.id),
      lat: Number(r.pinDraft.lat),
      lng: Number(r.pinDraft.lng),
      addressLine: r.pinDraft.addressLine,
      reservedDate: r.reservedDate, // 'YYYY-MM-DD'
      sortOrder: r.sortOrder,
      isActive: r.pinDraft.isActive,
      createdAt: r.pinDraft.createdAt,
    }));
  }

  async cancel(id: number, meCredentialId: string) {
    return this.dataSource.transaction(async (m) => {
      const myAccountId = await this.resolveMyAccountId(meCredentialId);
      const surveyReservationRepo = m.getRepository(SurveyReservation);

      const found = await surveyReservationRepo
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .select([
          'r.id AS id',
          'r.assignee_id AS assigneeId',
          'r.is_deleted AS isDeleted',
          'r.sort_order AS sortOrder',
          'r.pin_draft_id AS pinDraftId',
        ])
        .where('r.id = :id', { id })
        .getRawOne<{
          id: string;
          assigneeId: string;
          isDeleted: number;
          sortOrder: number;
          pinDraftId: string;
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

      await surveyReservationRepo
        .createQueryBuilder()
        .update()
        .set({ sortOrder: () => 'sort_order - 1' })
        .where('assignee_id = :aid', { aid: myAccountId })
        .andWhere('is_deleted = 0')
        .andWhere('sort_order > :deletedOrder', {
          deletedOrder: found.sortOrder,
        })
        .execute();

      return {
        reservationId: id,
        pin_draft_id: Number(found.pinDraftId),
        alreadyCanceled: false,
      };
    });
  }

  async reorder(meCredentialId: string, dto: ReorderSurveyReservationsDto) {
    return this.dataSource.transaction(async (m) => {
      const myAccountId = await this.resolveMyAccountId(meCredentialId);
      const surveyReservationRepo = m.getRepository(SurveyReservation);

      const current = await surveyReservationRepo
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.assignee_id = :aid', { aid: myAccountId })
        .andWhere('r.is_deleted = 0')
        .orderBy('r.sort_order', 'ASC')
        .addOrderBy('r.id', 'ASC')
        .getMany();

      const currentIds = new Set(current.map((r) => Number(r.id)));
      for (const it of dto.items) {
        if (!currentIds.has(it.reservationId)) {
          throw new BadRequestException(
            '내 활성 예약 목록에 없는 항목이 포함되어 있습니다.',
          );
        }
        if (it.sortOrder < 0) {
          throw new BadRequestException('sortOrder는 0 이상이어야 합니다.');
        }
      }

      const providedIds = new Set(dto.items.map((it) => it.reservationId));
      const missing = current.filter((r) => !providedIds.has(Number(r.id)));
      let normalized: Array<{ id: number; sortOrder: number }> = [
        ...dto.items.map((it) => ({
          id: it.reservationId,
          sortOrder: it.sortOrder,
        })),
        ...missing.map((r, i) => ({
          id: Number(r.id),
          sortOrder: dto.items.length + i,
        })),
      ];

      normalized = normalized
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((x, i) => ({ id: x.id, sortOrder: i }));

      if (normalized.length) {
        const ids = normalized.map((x) => x.id);
        const caseSql = normalized
          .map((x) => `WHEN id = ${x.id} THEN ${x.sortOrder}`)
          .join(' ');
        await surveyReservationRepo
          .createQueryBuilder()
          .update()
          .set({ sortOrder: () => `CASE ${caseSql} ELSE sort_order END` })
          .where('assignee_id = :aid', { aid: myAccountId })
          .andWhere('is_deleted = 0')
          .andWhere('id IN (:...ids)', { ids })
          .execute();
      }

      return { count: normalized.length };
    });
  }
}
