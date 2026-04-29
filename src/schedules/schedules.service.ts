import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
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
import { Contract } from 'src/contracts/entities/contract.entity';
import { ContractAssignee } from 'src/contracts/assignees/entities/assignee.entity';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    @InjectRepository(ContractAssignee)
    private readonly assigneeRepo: Repository<ContractAssignee>,
  ) { }

  /** 일정 목록 조회 (삭제되지 않은 것만) */
  async list(query?: ScheduleQueryDto) {
    const qb = this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.createdByAccount', 'acc')
      .leftJoinAndSelect('s.contract', 'c')
      .where('s.is_deleted = :isDeleted', { isDeleted: false })
      .orderBy('s.start_date', 'ASC');

    if (query?.from && query?.to) {
      qb.andWhere('s.start_date <= :to AND s.end_date >= :from', {
        from: `${query.from} 00:00:00`,
        to: `${query.to} 23:59:59`,
      });
    } else if (query?.from) {
      qb.andWhere('s.end_date >= :from', { from: `${query.from} 00:00:00` });
    } else if (query?.to) {
      qb.andWhere('s.start_date <= :to', { to: `${query.to} 23:59:59` });
    }

    if (query?.assignedStaffId) {
      qb.andWhere('(s.created_by_account_id = :staffId OR s.category = :holidayCat)', { 
        staffId: query.assignedStaffId,
        holidayCat: '휴무'
      });
    }

    if (query?.onlyHolidays) {
      qb.andWhere('s.category = :holidayCat', { holidayCat: '휴무' });
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
        customerPhone: item.customer_phone,
        platform: item.platform,
        meetingType: item.meeting_type,
        startDate: item.start_date,
        endDate: item.end_date,
        isAllDay: item.is_all_day,
        color: item.color,
        status: item.status,
        contractId: item.contract ? Number(item.contract.id) : null,
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

    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('종료 일시는 시작 일시보다 빠를 수 없습니다.');
    }

    const schedule = this.scheduleRepo.create({
      title: dto.title,
      content: dto.content,
      category: dto.category,
      location: dto.location,
      customer_phone: dto.customerPhone,
      platform: dto.platform,
      meeting_type: dto.meetingType || '신규',
      start_date: new Date(dto.startDate),
      end_date: new Date(dto.endDate),
      is_all_day: dto.isAllDay || false,
      color: dto.color || 'blue',
      created_by_account_id: targetAccountId,
    });

    const saved = await this.scheduleRepo.save(schedule);
    
    // 조인된 정보를 포함하여 다시 조회
    const fullSchedule = await this.scheduleRepo.findOne({
      where: { id: saved.id },
      relations: ['createdByAccount', 'contract'],
    });

    if (!fullSchedule) {
      throw new NotFoundException('일정을 찾을 수 없습니다.');
    }

    return {
      message: '일정 생성 완료',
      data: {
        id: Number(fullSchedule.id),
        title: fullSchedule.title,
        content: fullSchedule.content,
        category: fullSchedule.category,
        location: fullSchedule.location,
        customerPhone: fullSchedule.customer_phone,
        platform: fullSchedule.platform,
        meetingType: fullSchedule.meeting_type,
        startDate: fullSchedule.start_date,
        endDate: fullSchedule.end_date,
        isAllDay: fullSchedule.is_all_day,
        color: fullSchedule.color,
        status: fullSchedule.status,
        contractId: fullSchedule.contract ? Number(fullSchedule.contract.id) : null,
        creator: {
          id: fullSchedule.createdByAccount?.id,
          name: fullSchedule.createdByAccount?.name,
        },
        createdAt: fullSchedule.created_at,
        updatedAt: fullSchedule.updated_at,
      },
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
      relations: ['contract'],
    });
    if (!schedule) throw new NotFoundException('일정을 찾을 수 없습니다.');

    const isOwner = String(schedule.created_by_account_id) === String(account.id);
    const isPowerful = role === 'admin' || role === 'manager';

    if (!isOwner && !isPowerful) {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }

    // 데이터 정합성 체크: 계약이 작성된 일정은 휴무나 기타로 변경 불가
    if (schedule.contract && dto.category && dto.category !== schedule.category) {
      if (['휴무', '기타'].includes(dto.category)) {
        throw new BadRequestException('계약 기록이 있는 일정은 휴무나 기타로 변경할 수 없습니다.');
      }
    }

    const newStartDate = dto.startDate !== undefined ? new Date(dto.startDate) : schedule.start_date;
    const newEndDate = dto.endDate !== undefined ? new Date(dto.endDate) : schedule.end_date;

    if (new Date(newEndDate) < new Date(newStartDate)) {
      throw new BadRequestException('종료 일시는 시작 일시보다 빠를 수 없습니다.');
    }

    if (dto.title !== undefined) schedule.title = dto.title;
    if (dto.content !== undefined) schedule.content = dto.content;
    if (dto.category !== undefined) schedule.category = dto.category;
    if (dto.location !== undefined) schedule.location = dto.location;
    if (dto.customerPhone !== undefined) schedule.customer_phone = dto.customerPhone;
    if (dto.platform !== undefined) schedule.platform = dto.platform;
    if (dto.meetingType !== undefined) schedule.meeting_type = dto.meetingType;
    if (dto.startDate !== undefined) schedule.start_date = new Date(dto.startDate);
    if (dto.endDate !== undefined) schedule.end_date = new Date(dto.endDate);
    if (dto.isAllDay !== undefined) schedule.is_all_day = dto.isAllDay;
    if (dto.color !== undefined) schedule.color = dto.color;
    if (dto.status !== undefined) schedule.status = dto.status;
    const oldOwnerId = schedule.created_by_account_id; // 기존 담당자 미리 저장
    
    if (isPowerful && dto.createdByAccountId !== undefined) {
      schedule.created_by_account_id = dto.createdByAccountId;
    }

    const saved = await this.scheduleRepo.save(schedule);

    // 일정 정보 수정 시 연결된 계약기록도 동기화
    try {
      if (dto.customerPhone !== undefined || (dto.createdByAccountId !== undefined && String(oldOwnerId) !== String(dto.createdByAccountId))) {
        const linkedContract = await this.contractRepo.findOne({
          where: { scheduleId: String(id) }
        });

        if (linkedContract) {
          console.log(`[Sync] 연동된 계약(ID: ${linkedContract.id}) 동기화 시작...`);
          
          // 1. 고객 연락처 동기화 (값이 있을 때만)
          if (dto.customerPhone !== undefined && dto.customerPhone.trim() !== '') {
            linkedContract.customerPhone = dto.customerPhone;
          }
          
          // 2. 담당자(소유자) 및 배정원 목록 동기화
          if (dto.createdByAccountId !== undefined && String(oldOwnerId) !== String(dto.createdByAccountId)) {
            const newOwnerId = dto.createdByAccountId;
            console.log(`[Sync] 담당자 변경: ${oldOwnerId} -> ${newOwnerId}`);
            
          // 1. 계약 소유자 업데이트 (Raw Query로 강제 갱신)
          await this.contractRepo.query(
            `UPDATE contracts SET created_by_account_id = ? WHERE id = ?`,
            [Number(newOwnerId), Number(linkedContract.id)]
          );

          // 2. 배정원 동기화: 일정 담당자는 무조건 '1번(대표) 담당자'가 되어야 함.
          // 계약의 1번 배정원을 찾습니다.
          const firstAssignees = await this.assigneeRepo.query(
            `SELECT id, account_id FROM contract_assignees WHERE contract_id = ? ORDER BY sortOrder ASC, id ASC LIMIT 1`,
            [Number(linkedContract.id)]
          );

          if (firstAssignees.length > 0) {
            const firstAssignee = firstAssignees[0];
            
            // 1번 담당자가 이미 새 담당자가 아니라면 강제로 덮어씌움
            if (String(firstAssignee.account_id) !== String(newOwnerId)) {
              console.log(`[Sync] 1번 담당자(ID: ${firstAssignee.id})를 새 담당자(${newOwnerId})로 강제 교체`);
              
              // 혹시 새 담당자가 2번, 3번 자리에 이미 배정되어 있다면 중복을 막기 위해 기존 하위 번호는 지워버림
              await this.assigneeRepo.query(
                `DELETE FROM contract_assignees WHERE contract_id = ? AND account_id = ?`,
                [Number(linkedContract.id), Number(newOwnerId)]
              );

              // 1번 자리 덮어씌우기
              await this.assigneeRepo.query(
                `UPDATE contract_assignees SET account_id = ? WHERE id = ?`,
                [Number(newOwnerId), firstAssignee.id]
              );
            }
          } else {
            console.log(`[Sync] 배정 목록에 아무도 없어 새 담당자를 1번으로 추가`);
            const newAssignee = this.assigneeRepo.create({
              contract: { id: linkedContract.id as any },
              account: { id: String(newOwnerId) as any },
              sharePercent: 100,
              sortOrder: 0
            });
            await this.assigneeRepo.save(newAssignee);
          }
          }
          
          await this.contractRepo.save(linkedContract);
          console.log(`[Sync] 계약 동기화 완료`);
        }
      }
    } catch (syncError) {
      console.error('[Sync Error] 계약 동기화 중 오류 발생:', syncError);
      // 동기화 실패가 전체 일정 수정을 중단시키지 않게 하려면 여기서 throw를 안 할 수도 있지만, 
      // 사용자가 원인을 알아야 하므로 InternalServerError로 던집니다.
      throw new InternalServerErrorException(`계약 동기화 실패: ${syncError.message}`);
    }

    // 조인된 정보를 포함하여 다시 조회
    const fullSchedule = await this.scheduleRepo.findOne({
      where: { id: saved.id },
      relations: ['createdByAccount', 'contract'],
    });

    if (!fullSchedule) {
      throw new NotFoundException('일정을 찾을 수 없습니다.');
    }

    return {
      message: '일정 수정 완료',
      data: {
        id: Number(fullSchedule.id),
        title: fullSchedule.title,
        content: fullSchedule.content,
        category: fullSchedule.category,
        location: fullSchedule.location,
        customerPhone: fullSchedule.customer_phone,
        platform: fullSchedule.platform,
        meetingType: fullSchedule.meeting_type,
        startDate: fullSchedule.start_date,
        endDate: fullSchedule.end_date,
        isAllDay: fullSchedule.is_all_day,
        color: fullSchedule.color,
        status: fullSchedule.status,
        contractId: fullSchedule.contract ? Number(fullSchedule.contract.id) : null,
        creator: {
          id: fullSchedule.createdByAccount?.id,
          name: fullSchedule.createdByAccount?.name,
        },
        createdAt: fullSchedule.created_at,
        updatedAt: fullSchedule.updated_at,
      },
    };
  }

  /** Soft Delete 구현 */
  async delete(id: number, credentialId: string, role: string) {
    if (!credentialId) throw new BadRequestException('인증 정보가 없습니다.');
    const account = await this.resolveAccount(credentialId);

    const schedule = await this.scheduleRepo.findOne({
      where: { id: String(id), is_deleted: false },
      relations: ['contract'],
    });
    if (!schedule) throw new NotFoundException('일정을 찾을 수 없습니다.');

    // 계약이 작성된 일정은 삭제 불가
    if (schedule.contract) {
      throw new BadRequestException('계약 기록이 있는 일정은 삭제할 수 없습니다.');
    }

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
        customerPhone: item.customer_phone,
        platform: item.platform,
        meetingType: item.meeting_type,
        startDate: item.start_date,
        endDate: item.end_date,
        isAllDay: item.is_all_day,
        color: item.color,
        status: item.status,
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
