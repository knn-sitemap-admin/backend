import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OwnerEmployeeApiCountsService } from './owner-employee-api-counts.service';
import { EmployeeApiCountsQueryDto } from './dto/employee-api-counts-query.dto';
import { SessionAuthGuard } from '../../dashboard/auth/guards/session-auth.guard';
import { RolesGuard } from '../../dashboard/auth/guards/roles.guard';
import { Roles } from '../../dashboard/auth/decorators/roles.decorator';
import { SystemRole } from '../../dashboard/accounts/types/roles';

@Controller('owner/api/stats')
@UseGuards(SessionAuthGuard, RolesGuard)
export class OwnerEmployeeApiCountsController {
  constructor(private readonly service: OwnerEmployeeApiCountsService) {}

  @Roles(SystemRole.ADMIN)
  @Get('employee-api-counts')
  async list(@Query() dto: EmployeeApiCountsQueryDto) {
    const data = await this.service.list(dto);
    return { message: '사원별 주요 API 요청 횟수', data };
  }
}
