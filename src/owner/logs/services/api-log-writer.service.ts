import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiRequestLog } from '../entities/api-request-log.entity';
import { getReqStore } from '../../../common/request-context/request-context';

type WriteInput = {
  credentialId: string | null;
  deviceType: 'pc' | 'mobile' | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string | null;
  userAgent: string | null;
  requestBody: string | null;
  responseBody: string | null;
  error: null | {
    name: string;
    message: string;
    stack?: string | null;
  };
};

@Injectable()
export class ApiLogWriterService {
  constructor(
    @InjectRepository(ApiRequestLog)
    private readonly repo: Repository<ApiRequestLog>,
  ) {}

  async write(input: WriteInput) {
    const store = getReqStore();
    const queryLog =
      store && store.queries.length > 0 ? store.queries.join('\n') : null;

    const row = this.repo.create({
      credential_id: input.credentialId,
      device_type: input.deviceType,
      method: input.method,
      path: input.path,
      status_code: input.statusCode,
      duration_ms: input.durationMs,
      ip: input.ip,
      user_agent: input.userAgent,
      request_body: input.requestBody,
      response_body: input.responseBody,
      query_log: queryLog,
      error_name: input.error?.name ?? null,
      error_message: input.error?.message ?? null,
      error_stack: input.error?.stack ?? null,
    });

    await this.repo.save(row);
  }
}
