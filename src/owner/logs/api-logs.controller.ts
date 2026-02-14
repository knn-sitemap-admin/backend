import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiLogQueryService } from './api-log-query.service';
import { ApiLogListQueryDto } from './dto/api-log-list-query.dto';
import { SessionAuthGuard } from '../../dashboard/auth/guards/session-auth.guard';
import { RolesGuard } from '../../dashboard/auth/guards/roles.guard';
import { Roles } from '../../dashboard/auth/decorators/roles.decorator';
import { SystemRole } from '../../dashboard/accounts/types/roles';

@Controller('owner/api/logs')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ApiLogsController {
  constructor(private readonly service: ApiLogQueryService) {}

  @Roles(SystemRole.ADMIN)
  @Get()
  async list(@Query() dto: ApiLogListQueryDto) {
    const data = await this.service.list(dto);
    return { message: 'API 로그 목록', data };
  }

  @Roles(SystemRole.ADMIN)
  @Get(':id')
  async detail(@Param('id') id: string) {
    const data = await this.service.detail(id);
    return { message: 'API 로그 상세', data };
  }
}
