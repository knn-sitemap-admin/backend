import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Schedule } from './entities/schedule.entity';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ScheduleQueryDto,
} from './dto/schedule.dto';
import { Account } from '../dashboard/accounts/entities/account.entity';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  /** 일정 목록 조회 (삭제되지 않은 것만) */
  async list(query?: ScheduleQueryDto) {
    const qb = this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.createdByAccount', 'acc')
      .where('s.is_deleted = :isDeleted', { isDeleted: false })
      .orderBy('s.start_date', 'ASC');

    if (query?.from && query?.to) {
      qb.andWhere('s.start_date BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      });
    } else if (query?.from) {
      qb.andWhere('s.start_date >= :from', { from: query.from });
    } else if (query?.to) {
      qb.andWhere('s.start_date <= :to', { to: query.to });
    }

    const items = await qb.getMany();
    return {
      message: '일정 목록 조회 완료',
      data: items.map((item) => ({
        id: Number(item.id),
        title: item.title,
        content: item.content,
        category: item.category,
        location: item.location,
        customerPhoneLast4: item.customer_phone_last_4,
        meetingType: item.meeting_type,
        startDate: item.start_date,
        endDate: item.end_date,
        isAllDay: item.is_all_day,
        color: item.color,
        creator: {
          id: item.createdByAccount?.id,
          name: item.createdByAccount?.name,
        },
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
    };
  }

  async create(dto: CreateScheduleDto, credentialId: string, role: string) {
    if (!credentialId) throw new BadRequestException('인증 정보가 없습니다.');
    const account = await this.resolveAccount(credentialId);

    const isPowerful = role === 'admin' || role === 'manager';
    const targetAccountId = (isPowerful && dto.createdByAccountId) 
      ? dto.createdByAccountId 
      : account.id;

    const schedule = this.scheduleRepo.create({
      title: dto.title,
      content: dto.content,
      category: dto.category,
      location: dto.location,
      customer_phone_last_4: dto.customerPhoneLast4,
      meeting_type: dto.meetingType || '신규',
      start_date: new Date(dto.startDate),
      end_date: new Date(dto.endDate),
      is_all_day: dto.isAllDay || false,
      color: dto.color || 'blue',
      created_by_account_id: targetAccountId,
    });

    const saved = await this.scheduleRepo.save(schedule);
    return {
      message: '일정 생성 완료',
      data: saved,
    };
  }

  async update(
    id: number,
    dto: UpdateScheduleDto,
    credentialId: string,
    role: string,
  ) {
    if (!credentialId) throw new BadRequestException('인증 정보가 없습니다.');
    const account = await this.resolveAccount(credentialId);

    const schedule = await this.scheduleRepo.findOne({
      where: { id: String(id), is_deleted: false },
    });
    if (!schedule) throw new NotFoundException('일정을 찾을 수 없습니다.');

    const isOwner = String(schedule.created_by_account_id) === String(account.id);
    const isPowerful = role === 'admin' || role === 'manager';

    if (!isOwner && !isPowerful) {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }

    if (dto.title !== undefined) schedule.title = dto.title;
    if (dto.content !== undefined) schedule.content = dto.content;
    if (dto.category !== undefined) schedule.category = dto.category;
    if (dto.location !== undefined) schedule.location = dto.location;
    if (dto.customerPhoneLast4 !== undefined) schedule.customer_phone_last_4 = dto.customerPhoneLast4;
    if (dto.meetingType !== undefined) schedule.meeting_type = dto.meetingType;
    if (dto.startDate !== undefined) schedule.start_date = new Date(dto.startDate);
    if (dto.endDate !== undefined) schedule.end_date = new Date(dto.endDate);
    if (dto.isAllDay !== undefined) schedule.is_all_day = dto.isAllDay;
    if (dto.color !== undefined) schedule.color = dto.color;

    const saved = await this.scheduleRepo.save(schedule);
    return {
      message: '일정 수정 완료',
      data: saved,
    };
  }

  /** Soft Delete 구현 */
  async delete(id: number, credentialId: string, role: string) {
    if (!credentialId) throw new BadRequestException('인증 정보가 없습니다.');
    const account = await this.resolveAccount(credentialId);

    const schedule = await this.scheduleRepo.findOne({
      where: { id: String(id), is_deleted: false },
    });
    if (!schedule) throw new NotFoundException('일정을 찾을 수 없습니다.');

    const isOwner = String(schedule.created_by_account_id) === String(account.id);
    const isPowerful = role === 'admin' || role === 'manager';

    if (!isOwner && !isPowerful) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }

    schedule.is_deleted = true;
    schedule.deleted_at = new Date();
    await this.scheduleRepo.save(schedule);

    return {
      message: '일정삭제 완료 (임시 보관함으로 이동)',
    };
  }

  /** 일정 복원 */
  async restore(id: number, credentialId: string, role: string) {
    if (!credentialId) throw new BadRequestException('인증 정보가 없습니다.');
    const account = await this.resolveAccount(credentialId);

    const schedule = await this.scheduleRepo.findOne({
      where: { id: String(id), is_deleted: true },
    });
    if (!schedule) throw new NotFoundException('복원할 일정을 찾을 수 없습니다.');

    const isPowerful = role === 'admin' || role === 'manager';
    const isOwner = String(schedule.created_by_account_id) === String(account.id);

    if (!isOwner && !isPowerful) {
      throw new ForbiddenException('복원 권한이 없습니다.');
    }

    schedule.is_deleted = false;
    schedule.deleted_at = null;
    await this.scheduleRepo.save(schedule);

    return {
      message: '일정 복원 완료',
      data: schedule,
    };
  }

  /** 삭제된 일정 목록 조회 */
  async listDeleted(credentialId: string, role: string) {
    if (!credentialId) throw new BadRequestException('인증 정보가 없습니다.');
    const account = await this.resolveAccount(credentialId);

    const isPowerful = role === 'admin' || role === 'manager';
    
    const items = await this.scheduleRepo.find({
      where: isPowerful ? { is_deleted: true } : { created_by_account_id: account.id, is_deleted: true },
      relations: ['createdByAccount'],
      order: { deleted_at: 'DESC' },
    });

    return {
      message: '삭제된 일정 목록 조회 완료',
      data: items.map((item) => ({
        id: Number(item.id),
        title: item.title,
        content: item.content,
        category: item.category,
        location: item.location,
        customerPhoneLast4: item.customer_phone_last_4,
        meetingType: item.meeting_type,
        startDate: item.start_date,
        endDate: item.end_date,
        isAllDay: item.is_all_day,
        color: item.color,
        creator: {
          id: item.createdByAccount?.id,
          name: item.createdByAccount?.name,
        },
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        deletedAt: item.deleted_at,
      })),
    };
  }

  /** 매일 자정, 삭제된 지 30일이 지난 일정을 영구 삭제 */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupDeletedSchedules() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.scheduleRepo.delete({
      is_deleted: true,
      deleted_at: LessThan(thirtyDaysAgo),
    });

    console.log(`[Schedule Cleanup] ${result.affected} items permanently removed.`);
  }

  private async resolveAccount(credentialId: string): Promise<Account> {
    const account = await this.accountRepo.findOne({
      where: { credential_id: String(credentialId), is_deleted: false },
    });
    if (!account) throw new ForbiddenException('유효하지 않은 계정입니다.');
    return account;
  }
}
