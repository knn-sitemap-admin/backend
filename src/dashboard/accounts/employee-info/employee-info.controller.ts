import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SystemRole } from '../types/roles';
import { UpsertEmployeeInfoDto } from '../dto/upsert-employee-info.dto';
import { EmployeeInfoService } from './employee-info.service';

@UseGuards(SessionAuthGuard, RolesGuard)
@Controller('dashboard/accounts')
export class EmployeeInfoController {
  constructor(private readonly service: EmployeeInfoService) {}

  // 타 계정 정보 입력/수정
  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  @Post('employees/:credentialId/info')
  async updateEmployeeInfo(
    @Param('credentialId') credentialId: string,
    @Body() dto: UpsertEmployeeInfoDto,
  ) {
    const result = await this.service.upsertByCredentialId(credentialId, dto);
    return { message: '사용자 정보 저장', data: result };
  }

  // 내 정보 입력/수정
  @Post('me/info')
  async upsertMine(@Req() req: any, @Body() dto: UpsertEmployeeInfoDto) {
    const credentialId = req.session?.user?.credentialId as string | undefined;
    if (!credentialId) throw new Error('세션이 없습니다');
    // 본인 수정 시 직급 수정 금지
    if ('positionRank' in dto) {
      delete dto.positionRank;
    }
    const result = await this.service.upsertByCredentialId(credentialId, dto);
    return { message: '내 정보 저장', data: result };
  }

  // 내 프로필 조회
  @Get('me/profile')
  async getMyProfile(@Req() req: any) {
    const credentialId = req.session?.user?.credentialId as string | undefined;
    const profile = await this.service.getProfileByCredentialId(
      credentialId ?? '',
    );
    return { message: '내 프로필', data: profile };
  }

  // 무소속 사용자 조회
  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  @Get('employees/unassigned')
  async getUnassignedEmployees() {
    const list = await this.service.findUnassignedEmployees();
    return { message: '무소속 사용자 목록', data: list };
  }
}
