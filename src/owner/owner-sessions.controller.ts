import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { OwnerSessionsService } from './owner-sessions.service';
import { ForceLogoutDto } from './dto/force-logout.dto';
import { SessionAuthGuard } from '../dashboard/auth/guards/session-auth.guard';
import { RolesGuard } from '../dashboard/auth/guards/roles.guard';
import { Roles } from '../dashboard/auth/decorators/roles.decorator';
import { SystemRole } from '../dashboard/accounts/types/roles';

@Controller('owner/api/sessions')
@UseGuards(SessionAuthGuard, RolesGuard)
export class OwnerSessionsController {
  constructor(private readonly service: OwnerSessionsService) {}

  @Roles(SystemRole.ADMIN)
  @Post('force-logout')
  async forceLogout(@Body() dto: ForceLogoutDto) {
    const data = await this.service.forceLogout({
      credentialId: dto.credentialId,
      deviceType: dto.deviceType ?? 'all',
    });
    return { message: '강제 로그아웃', data };
  }
}
