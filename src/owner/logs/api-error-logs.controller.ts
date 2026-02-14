import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiErrorLogQueryService } from './api-error-log-query.service';
import { ApiErrorLogListQueryDto } from './dto/api-error-log-list-query.dto';
import { SessionAuthGuard } from '../../dashboard/auth/guards/session-auth.guard';
import { RolesGuard } from '../../dashboard/auth/guards/roles.guard';
import { Roles } from '../../dashboard/auth/decorators/roles.decorator';
import { SystemRole } from '../../dashboard/accounts/types/roles';

@Controller('owner/api/error-logs')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ApiErrorLogsController {
  constructor(private readonly service: ApiErrorLogQueryService) {}

  @Roles(SystemRole.ADMIN)
  @Get()
  async list(@Query() dto: ApiErrorLogListQueryDto) {
    const data = await this.service.list(dto);
    return { message: '에러 API 로그 목록', data };
  }
}
