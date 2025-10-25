import {
  Body,
  Controller,
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
import { PatchCredentialDisableDto } from '../dto/patch-credential-disable.dto';
import { PatchCredentialRoleDto } from '../dto/patch-credential-role.dto';
import { CredentialsService } from './credentials.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';

@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('dashboard/accounts/credentials')
export class CredentialsController {
  constructor(private readonly service: CredentialsService) {}

  @Post()
  @Roles('admin')
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    const created = await this.service.createEmployee(dto);
    return { message: '계정 생성', data: created };
  }

  @Get()
  @Roles('admin')
  async listCredentials() {
    const items = await this.service.listAllCredentials();
    return { message: '계정 목록', data: items };
  }

  @Get(':id')
  @Roles('admin', 'manager')
  async getCredentialDetail(@Param('id') id: string) {
    const data = await this.service.getCredentialDetail(id);
    return { message: '계정 상세 조회', data };
  }

  @Patch(':id/disable')
  @Roles('admin')
  async patchCredentialDisable(
    @Param('id') id: string,
    @Body() dto: PatchCredentialDisableDto,
  ) {
    const result = await this.service.setCredentialDisabled(id, dto.disabled);
    return { message: '계정 활성/비활성 변경', data: result };
  }

  @Patch(':id/role')
  @Roles('admin')
  async patchCredentialRole(
    @Param('id') id: string,
    @Body() dto: PatchCredentialRoleDto,
  ) {
    const result = await this.service.setCredentialRole(id, dto.role);
    return { message: '권한 변경', data: result };
  }
}
