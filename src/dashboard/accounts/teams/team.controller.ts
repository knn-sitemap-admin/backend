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

@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('dashboard/accounts/teams')
export class TeamController {
  constructor(private readonly service: TeamService) {}

  @Post()
  async create(@Body() dto: CreateTeamDto) {
    const created = await this.service.create(dto);
    return { message: '팀 생성', data: created };
  }

  @Get()
  async list() {
    const items = await this.service.list();
    return { message: '팀 목록', data: items };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const team = await this.service.get(id);
    return { message: '팀 상세', data: team };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    const updated = await this.service.update(id, dto);
    return { message: '팀 수정', data: updated };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.service.remove(id);
    return { message: '팀 삭제', data: result };
  }
}
