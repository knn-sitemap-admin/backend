import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiLogExportService } from './services/api-log-export.service';
import { ApiLogListQueryDto } from './dto/api-log-list-query.dto';
import { ApiErrorLogListQueryDto } from './dto/api-error-log-list-query.dto';
import { SessionAuthGuard } from '../../dashboard/auth/guards/session-auth.guard';
import { RolesGuard } from '../../dashboard/auth/guards/roles.guard';
import { Roles } from '../../dashboard/auth/decorators/roles.decorator';
import { SystemRole } from '../../dashboard/accounts/types/roles';

@Controller('owner/api')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ApiLogsExportController {
  constructor(private readonly service: ApiLogExportService) {}

  @Roles(SystemRole.ADMIN)
  @Get('api-logs/export.xlsx')
  async exportLogs(@Query() dto: ApiLogListQueryDto, @Res() res: Response) {
    const buf = await this.service.exportLogsXlsx(dto);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="api-logs.xlsx"',
    );
    res.send(buf);
  }

  @Roles(SystemRole.ADMIN)
  @Get('error-logs/export.xlsx')
  async exportErrors(
    @Query() dto: ApiErrorLogListQueryDto,
    @Res() res: Response,
  ) {
    const buf = await this.service.exportErrorLogsXlsx(dto);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="error-logs.xlsx"',
    );
    res.send(buf);
  }
}
