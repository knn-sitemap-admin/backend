import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, MoreThanOrEqual, Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import { ApiRequestLog } from '../entities/api-request-log.entity';
import { ApiLogListQueryDto } from '../dto/api-log-list-query.dto';
import { ApiErrorLogListQueryDto } from '../dto/api-error-log-list-query.dto';

function safeText(v: unknown, max = 200): string {
  const s = String(v ?? '');
  if (s.length <= max) return s;
  return s.slice(0, max) + '...';
}

@Injectable()
export class ApiLogExportService {
  constructor(
    @InjectRepository(ApiRequestLog)
    private readonly repo: Repository<ApiRequestLog>,
  ) {}

  async exportLogsXlsx(dto: ApiLogListQueryDto): Promise<Buffer> {
    const where: any = {};
    if (dto.credentialId) where.credential_id = String(dto.credentialId);
    if (dto.pathContains) where.path = Like(`%${dto.pathContains}%`);

    const rows = await this.repo.find({
      where,
      order: { created_at: 'DESC' as any },
      take: 500,
      select: [
        'id',
        'created_at',
        'credential_id',
        'device_type',
        'method',
        'path',
        'status_code',
        'duration_ms',
        'ip',
        'user_agent',
      ],
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('api_logs');

    ws.columns = [
      { header: 'id', key: 'id', width: 12 },
      { header: 'createdAt', key: 'createdAt', width: 20 },
      { header: 'credentialId', key: 'credentialId', width: 14 },
      { header: 'device', key: 'device', width: 10 },
      { header: 'method', key: 'method', width: 8 },
      { header: 'path', key: 'path', width: 40 },
      { header: 'status', key: 'status', width: 8 },
      { header: 'durationMs', key: 'durationMs', width: 12 },
      { header: 'ip', key: 'ip', width: 16 },
      { header: 'userAgent', key: 'userAgent', width: 60 },
    ];

    for (const r of rows) {
      ws.addRow({
        id: String(r.id),
        createdAt: r.created_at ? r.created_at.toISOString() : '',
        credentialId: r.credential_id ? String(r.credential_id) : '',
        device: r.device_type ?? '',
        method: r.method ?? '',
        path: r.path ?? '',
        status: r.status_code ?? 0,
        durationMs: r.duration_ms ?? 0,
        ip: r.ip ?? '',
        userAgent: safeText(r.user_agent, 300),
      });
    }

    ws.getRow(1).font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  async exportErrorLogsXlsx(dto: ApiErrorLogListQueryDto): Promise<Buffer> {
    const where: any = { status_code: MoreThanOrEqual(400) };
    if (dto.credentialId) where.credential_id = String(dto.credentialId);

    const rows = await this.repo.find({
      where,
      order: { created_at: 'DESC' as any },
      take: 500,
      select: [
        'id',
        'created_at',
        'credential_id',
        'device_type',
        'method',
        'path',
        'status_code',
        'duration_ms',
        'ip',
        'user_agent',
      ],
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('error_logs');

    ws.columns = [
      { header: 'id', key: 'id', width: 12 },
      { header: 'createdAt', key: 'createdAt', width: 20 },
      { header: 'credentialId', key: 'credentialId', width: 14 },
      { header: 'device', key: 'device', width: 10 },
      { header: 'method', key: 'method', width: 8 },
      { header: 'path', key: 'path', width: 40 },
      { header: 'status', key: 'status', width: 8 },
      { header: 'durationMs', key: 'durationMs', width: 12 },
      { header: 'ip', key: 'ip', width: 16 },
      { header: 'userAgent', key: 'userAgent', width: 60 },
    ];

    for (const r of rows) {
      ws.addRow({
        id: String(r.id),
        createdAt: r.created_at ? r.created_at.toISOString() : '',
        credentialId: r.credential_id ? String(r.credential_id) : '',
        device: r.device_type ?? '',
        method: r.method ?? '',
        path: r.path ?? '',
        status: r.status_code ?? 0,
        durationMs: r.duration_ms ?? 0,
        ip: r.ip ?? '',
        userAgent: safeText(r.user_agent, 300),
      });
    }

    ws.getRow(1).font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }
}
