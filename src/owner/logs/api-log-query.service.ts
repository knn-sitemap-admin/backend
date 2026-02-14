import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { ApiRequestLog } from './entities/api-request-log.entity';
import { ApiLogListQueryDto } from './dto/api-log-list-query.dto';

@Injectable()
export class ApiLogQueryService {
  constructor(
    @InjectRepository(ApiRequestLog)
    private readonly repo: Repository<ApiRequestLog>,
  ) {}

  async list(dto: ApiLogListQueryDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const where: any = {};
    if (dto.credentialId) where.credential_id = String(dto.credentialId);
    if (dto.pathContains) where.path = Like(`%${dto.pathContains}%`);

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

  async detail(id: string) {
    const row = await this.repo.findOne({ where: { id: String(id) } });
    if (!row) throw new NotFoundException('로그를 찾을 수 없습니다.');
    return row;
  }
}
