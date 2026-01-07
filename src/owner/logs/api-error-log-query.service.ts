import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { ApiRequestLog } from './entities/api-request-log.entity';
import { ApiErrorLogListQueryDto } from './dto/api-error-log-list-query.dto';

@Injectable()
export class ApiErrorLogQueryService {
  constructor(
    @InjectRepository(ApiRequestLog)
    private readonly repo: Repository<ApiRequestLog>,
  ) {}

  async list(dto: ApiErrorLogListQueryDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const where: any = {
      status_code: MoreThanOrEqual(400),
    };

    if (dto.credentialId) {
      where.credential_id = String(dto.credentialId);
    }

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { created_at: 'DESC' as any },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: [
        'id',
        'created_at',
        'credential_id',
        'device_type',
        'method',
        'path',
        'status_code',
        'duration_ms',
      ],
    });

    return {
      page,
      pageSize,
      total,
      items: rows,
    };
  }
}
