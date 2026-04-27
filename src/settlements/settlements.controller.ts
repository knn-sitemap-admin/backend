import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { SessionAuthGuard } from '../dashboard/auth/guards/session-auth.guard';
import { RolesGuard } from '../dashboard/auth/guards/roles.guard';
import { Roles } from '../dashboard/auth/decorators/roles.decorator';
import { SystemRole } from '../dashboard/accounts/types/roles';

@UseGuards(SessionAuthGuard, RolesGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Roles(SystemRole.ADMIN)
  @Get()
  async getMonthly(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.settlementsService.getMonthlySettlements(year, month);
  }

  @Roles(SystemRole.ADMIN)
  @Post()
  async save(@Req() req: any, @Body() data: any) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    return this.settlementsService.saveSettlement(data, credentialId);
  }

  @Roles(SystemRole.ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: 'pending' | 'paid',
  ) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    return this.settlementsService.updateStatus(id, status, credentialId);
  }

  @Roles(SystemRole.ADMIN)
  @Get('detail')
  async getDetail(
    @Query('accountId') accountId: string,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.settlementsService.getSettlementDetail(accountId, year, month);
  }

  @Roles(SystemRole.ADMIN)
  @Get('yearly')
  async getYearly(@Query('year', ParseIntPipe) year: number) {
    return this.settlementsService.getYearlySettlements(year);
  }

  @Roles(SystemRole.ADMIN)
  @Post('cleanup')
  async cleanup() {
    return this.settlementsService.cleanupOldLedgerEntries();
  }
}
