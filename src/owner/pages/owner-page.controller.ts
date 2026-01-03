import {
  Controller,
  Get,
  Param,
  Query,
  Render,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../dashboard/auth/decorators/roles.decorator';
import { SystemRole } from '../../dashboard/accounts/types/roles';
import { OwnerSessionGuard } from '../guards/owner-session.guard';

@Controller('owner')
@UseGuards(OwnerSessionGuard)
export class OwnerPageController {
  @Get()
  @Render('owner/index')
  index() {
    // 최초 진입 시 기본 탭은 dashboard로
    return { activeTab: 'dashboard' };
  }

  @Get('partials/dashboard')
  @Render('owner/partials/dashboard')
  dashboardPartial() {
    return {};
  }

  @Get('partials/api-logs')
  @Render('owner/partials/api-logs')
  apiLogsPartial(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 20),
    };
  }

  @Get('partials/error-logs')
  @Render('owner/partials/error-logs')
  errorLogsPartial(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 20),
    };
  }

  @Get('partials/api-log-modal/:id')
  @Render('owner/partials/api-log-modal')
  apiLogModal(@Param('id') id: string) {
    return { id };
  }

  @Get('partials/employee-sessions')
  @Render('owner/partials/employee-sessions')
  employeeSessionsPartial(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 20),
    };
  }
}
