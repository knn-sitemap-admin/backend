import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SystemRole } from '../types/roles';
import { CreateTeamDto } from '../dto/create-team.dto';
import { UpdateTeamDto } from '../dto/update-team.dto';
import { TeamService } from './team.service';
import { UpdateTeamNameDto } from '../dto/update-team-name.dto';

@UseGuards(SessionAuthGuard, RolesGuard)
@Controller('dashboard/accounts/teams')
export class TeamController {
  constructor(private readonly service: TeamService) {}

  // 팀 구조 변경 후 안쓰임
  @Roles(SystemRole.ADMIN)
  @Post()
  async create(@Body() dto: CreateTeamDto) {
    const created = await this.service.create(dto);
    return { message: '팀 생성', data: created };
  }

  @Patch(':id/name')
  async updateName(@Param('id') id: string, @Body() dto: UpdateTeamNameDto) {
    const updated = await this.service.updateName(id, dto);
    return { message: '팀 이름 변경', data: updated };
  }

  @Roles(SystemRole.ADMIN, SystemRole.MANAGER, SystemRole.STAFF)
  @Get()
  async list() {
    const items = await this.service.list();
    return { message: '팀 목록', data: items };
  }

  @Roles(SystemRole.ADMIN, SystemRole.MANAGER, SystemRole.STAFF)
  @Get(':id')
  async get(@Param('id') id: string) {
    const team = await this.service.get(id);
    return { message: '팀 상세', data: team };
  }

  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    const updated = await this.service.update(id, dto);
    return { message: '팀 수정', data: updated };
  }

  //구조 바뀌고 안쓰임
  @Roles(SystemRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.service.remove(id);
    return { message: '팀 삭제', data: result };
  }

  // --- 수동 멤버 관리 API ---

  @Roles(SystemRole.ADMIN)
  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @Body('accountId') accountId: string,
    @Body('role') role: 'manager' | 'staff',
  ) {
    const result = await this.service.addMember(id, accountId, role);
    return { message: '팀 멤버 추가', data: result };
  }

  @Roles(SystemRole.ADMIN)
  @Delete(':id/members/:accountId')
  async removeMember(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
  ) {
    const result = await this.service.removeMember(id, accountId);
    return { message: '팀 멤버 제외', data: result };
  }

  @Roles(SystemRole.ADMIN)
  @Patch(':id/leader')
  async setLeader(
    @Param('id') id: string,
    @Body('accountId') accountId: string,
  ) {
    const result = await this.service.setLeader(id, accountId);
    return { message: '팀장 임명', data: result };
  }
}
