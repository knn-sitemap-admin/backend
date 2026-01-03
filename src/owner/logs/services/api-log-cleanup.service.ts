import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiRequestLog } from '../entities/api-request-log.entity';

@Injectable()
export class ApiLogCleanupService {
  constructor(
    @InjectRepository(ApiRequestLog)
    private readonly repo: Repository<ApiRequestLog>,
  ) {}

  // 매달 1일 03:00
  @Cron('0 0 3 1 * *')
  async cleanup() {
    const days = Number(process.env.API_LOG_RETENTION_DAYS ?? 30);
    const cut = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    await this.repo
      .createQueryBuilder()
      .delete()
      .from(ApiRequestLog)
      .where('created_at < :cut', { cut })
      .execute();
  }
}
