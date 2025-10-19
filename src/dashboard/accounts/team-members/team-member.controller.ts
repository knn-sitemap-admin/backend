import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SystemRole } from '../types/roles';
import { TeamMemberService } from './team-member.service';
import { PatchTeamMemberDto } from '../dto/patch-team-member.dto';
import { ReplaceManagerDto } from '../dto/replace-manager.dto';
import { AssignTeamMemberDto } from '../dto/assign-team-member.dto';

@UseGuards(SessionAuthGuard, RolesGuard)
@Controller('dashboard/accounts')
export class TeamMemberController {
  constructor(private readonly service: TeamMemberService) {}

  // 사원 팀 배정
  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  @Post('team-members')
  async assignTeamMember(@Body() dto: AssignTeamMemberDto) {
    const created = await this.service.assignTeamMember(dto);
    return { message: '팀 배정', data: created };
  }

  // 역할/주팀 변경
  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  @Patch('team-members/:memberId')
  async updateTeamMember(
    @Param('memberId') memberId: string,
    @Body() dto: PatchTeamMemberDto,
  ) {
    const updated = await this.service.updateTeamMember(memberId, dto);
    return { message: '팀멤버 수정', data: updated };
  }

  // 팀 제거(무소속 처리)
  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  @Delete('team-members/:memberId')
  async removeTeamMember(@Param('memberId') memberId: string) {
    const result = await this.service.removeTeamMember(memberId);
    return { message: '팀멤버 제거', data: result };
  }

  // 팀장 교체
  @Roles(SystemRole.ADMIN)
  @Post('teams/:teamId/replace-manager')
  async replaceManager(
    @Param('teamId') teamId: string,
    @Body() dto: ReplaceManagerDto,
  ) {
    const result = await this.service.replaceTeamManager(
      teamId,
      dto.newCredentialId,
    );
    return { message: '팀장 교체', data: result };
  }
}
