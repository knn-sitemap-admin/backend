import {
  Controller,
  Get,
  Param,
  Query,
  Render,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../../dashboard/auth/guards/session-auth.guard';
import { RolesGuard } from '../../dashboard/auth/guards/roles.guard';
import { Roles } from '../../dashboard/auth/decorators/roles.decorator';
import { SystemRole } from '../../dashboard/accounts/types/roles';

@Controller('owner')
@UseGuards(SessionAuthGuard, RolesGuard)
export class OwnerPageController {
  @Roles(SystemRole.ADMIN)
  @Get()
  @Render('owner/index')
  index() {
    // 최초 진입 시 기본 탭은 dashboard로
    return { activeTab: 'dashboard' };
  }

  @Roles(SystemRole.ADMIN)
  @Get('partials/dashboard')
  @Render('owner/partials/dashboard')
  dashboardPartial() {
    return {};
  }

  @Roles(SystemRole.ADMIN)
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

  @Roles(SystemRole.ADMIN)
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

  @Roles(SystemRole.ADMIN)
  @Get('partials/api-log-modal/:id')
  @Render('owner/partials/api-log-modal')
  apiLogModal(@Param('id') id: string) {
    return { id };
  }
}
