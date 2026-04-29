import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { Notice } from './entities/notice.entity';
import { NoticeRead } from './entities/notice-read.entity';
import { Account } from '../dashboard/accounts/entities/account.entity';

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(Notice)
    private readonly noticeRepo: Repository<Notice>,
    @InjectRepository(NoticeRead)
    private readonly noticeReadRepo: Repository<NoticeRead>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async create(credentialId: string, dto: CreateNoticeDto) {
    const author = await this.accountRepo.findOne({
      where: { credential_id: String(credentialId) },
    });

    const notice = this.noticeRepo.create({
      ...dto,
      author: author || null,
    });

    return await this.noticeRepo.save(notice);
  }

  async findAll() {
    return await this.noticeRepo.find({
      relations: ['author'],
      order: {
        isPinned: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: number, credentialId?: string) {
    const notice = await this.noticeRepo.findOne({
      where: { id: Number(id) },
      relations: ['author'],
    });

    if (!notice) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }

    // 작성한 계정 정보 (Author 아님, 현재 로그인한 Account)
    if (credentialId) {
      const viewer = await this.accountRepo.findOne({
        where: { credential_id: String(credentialId) },
      });

      if (viewer) {
        // 이미 읽었는지 확인 후 없으면 추가
        const existing = await this.noticeReadRepo.findOne({
          where: {
            notice: { id: notice.id },
            account: { id: viewer.id },
          },
        });

        if (!existing) {
          await this.noticeReadRepo.save(
            this.noticeReadRepo.create({
              notice: { id: notice.id },
              account: { id: viewer.id },
            }),
          );
          // 실제 신규 조회일 때만 조회수 증가
          await this.noticeRepo.increment({ id: notice.id }, 'views', 1);
        }
      }
    }

    return notice;
  }

  async getReadStatus(id: number) {
    const notice = await this.noticeRepo.findOne({ where: { id: Number(id) } });
    if (!notice) throw new NotFoundException('공지를 찾을 수 없습니다.');

    // 1. 전체 직원 (삭제되지 않고 정지되지 않았으며, 관리자가 아닌 계정만)
    const allEmployees = await this.accountRepo.find({
      where: { 
        is_deleted: false,
        credential: { 
          is_disabled: false,
          role: Not('admin')
        }
      },
      relations: ['credential']
    });

    // 2. 읽은 사람
    const reads = await this.noticeReadRepo.find({
      where: { notice: { id: Number(id) } },
      relations: ['account'],
    });

    const readAccountIds = new Set(reads.map((r) => r.account.id));

    const readList = allEmployees.filter((e) => readAccountIds.has(e.id));
    const unreadList = allEmployees.filter((e) => !readAccountIds.has(e.id));

    return {
      total: allEmployees.length,
      readCount: readList.length,
      unreadCount: unreadList.length,
      readList,
      unreadList,
    };
  }

  async update(id: number, dto: UpdateNoticeDto) {
    const notice = await this.findOne(id);
    Object.assign(notice, dto);
    return await this.noticeRepo.save(notice);
  }

  async remove(id: number) {
    const notice = await this.noticeRepo.findOne({ where: { id: Number(id) } });
    if (!notice) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }
    await this.noticeRepo.softDelete(id);
  }
}
