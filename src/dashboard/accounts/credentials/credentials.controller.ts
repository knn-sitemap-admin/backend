import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SystemRole } from '../types/roles';
import { PatchCredentialDisableDto } from '../dto/patch-credential-disable.dto';
import { PatchCredentialRoleDto } from '../dto/patch-credential-role.dto';
import { PatchCredentialCanDownloadImageDto } from '../dto/patch-credential-can-download-image.dto';
import { CredentialsService } from './credentials.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { PatchAccountPasswordDto } from '../dto/patch-account-password.dto';

@UseGuards(SessionAuthGuard, RolesGuard)
@Controller('dashboard/accounts/credentials')
export class CredentialsController {
  constructor(private readonly service: CredentialsService) {}

  @Roles(SystemRole.ADMIN)
  @Post()
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    const created = await this.service.createEmployee(dto);
    return { message: '계정 생성', data: created };
  }

  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  @Get()
  async listCredentials() {
    const items = await this.service.listAllCredentials();
    return { message: '계정 목록', data: items };
  }

  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  @Get('unassigned-employees')
  async listUnassignedEmployees() {
    const data = await this.service.listUnassignedEmployees();
    return { message: '무소속 사원 목록', data };
  }

  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  @Get(':id')
  async getCredentialDetail(@Param('id') id: string) {
    const data = await this.service.getCredentialDetail(id);
    return { message: '계정 상세 조회', data };
  }

  @Roles(SystemRole.ADMIN)
  @Patch(':id/disable')
  async patchCredentialDisable(
    @Param('id') id: string,
    @Body() dto: PatchCredentialDisableDto,
  ) {
    const result = await this.service.setCredentialDisabled(id, dto.disabled);
    return { message: '계정 활성/비활성 변경', data: result };
  }

  @Roles(SystemRole.ADMIN)
  @Patch(':id/can-download-image')
  async patchCredentialCanDownloadImage(
    @Param('id') id: string,
    @Body() dto: PatchCredentialCanDownloadImageDto,
  ) {
    const result = await this.service.setCredentialCanDownloadImage(
      id,
      dto.canDownloadImage,
    );
    return { message: '이미지 다운로드 권한 변경', data: result };
  }

  @Roles(SystemRole.ADMIN)
  @Patch(':id/password')
  async patchPassword(
    @Param('id') id: string,
    @Body() dto: PatchAccountPasswordDto,
  ) {
    await this.service.updatePassword(id, dto.password);
    return { message: '비밀번호 변경 완료' };
  }

  @Roles(SystemRole.ADMIN)
  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    await this.service.softDelete(id);
    return { message: '계정 가삭제 완료' };
  }
}
