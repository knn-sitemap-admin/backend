import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { OwnerEmployeeSessionsService } from './owner-employee-sessions.service';
import { EmployeeSessionListQueryDto } from './dto/employee-session-list-query.dto';
import { ForceLogoutDto } from './dto/force-logout.dto';
import { OwnerSessionsService } from '../owner-sessions.service';
import { SessionAuthGuard } from '../../dashboard/auth/guards/session-auth.guard';
import { RolesGuard } from '../../dashboard/auth/guards/roles.guard';
import { Roles } from '../../dashboard/auth/decorators/roles.decorator';
import { SystemRole } from '../../dashboard/accounts/types/roles';

@Controller('owner/api/employees')
@UseGuards(SessionAuthGuard, RolesGuard)
export class OwnerEmployeeSessionsController {
  constructor(
    private readonly service: OwnerEmployeeSessionsService,
    private readonly sessions: OwnerSessionsService,
  ) {}

  @Roles(SystemRole.ADMIN)
  @Get('sessions')
  async list(@Query() dto: EmployeeSessionListQueryDto) {
    const data = await this.service.listEmployeesWithSessions(dto);
    return { message: '직원 세션 목록', data };
  }

  @Roles(SystemRole.ADMIN)
  @Post('force-logout')
  async forceLogout(@Body() dto: ForceLogoutDto) {
    const data = await this.sessions.forceLogout({
      credentialId: dto.credentialId,
      deviceType: dto.deviceType,
    });
    return { message: '강제 로그아웃', data };
  }
}
