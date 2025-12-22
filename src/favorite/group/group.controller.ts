import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { SessionData } from 'express-session';
import { GroupService } from './group.service';
import { UpdateFavoriteGroupDto } from './dto/update-group.dto';
import { ReorderFavoriteGroupsDto } from './dto/reorder-favorite-groups.dto';
import { SessionAuthGuard } from '../../dashboard/auth/guards/session-auth.guard';

@Controller('favorite/group')
@UseGuards(SessionAuthGuard)
export class GroupController {
  constructor(private readonly service: GroupService) {}

  private getCredentialId(req: { session: SessionData }): string {
    const credentialId = String((req.session as any)?.user?.credentialId ?? '');
    if (!credentialId) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }
    return credentialId;
  }

  @Get()
  async getGroups(
    @Query('includeItems') includeItems: string,
    @Req() req: { session: SessionData },
  ) {
    const credentialId = this.getCredentialId(req);
    const withItems = includeItems === '1' || includeItems === 'true';

    const data = await this.service.getGroups(credentialId, withItems);
    return { message: '조회 성공', data };
  }

  @Patch(':groupId')
  async updateGroupTitle(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateFavoriteGroupDto,
    @Req() req: { session: SessionData },
  ) {
    const credentialId = this.getCredentialId(req);
    const data = await this.service.updateGroupTitle(
      credentialId,
      groupId,
      dto.title,
    );
    return { message: '수정 성공', data };
  }

  @Patch('reorder')
  async reorderGroups(
    @Body() dto: ReorderFavoriteGroupsDto,
    @Req() req: { session: SessionData },
  ) {
    const credentialId = this.getCredentialId(req);
    await this.service.reorderGroups(credentialId, dto.orders);
    return { message: '정렬 순서 변경 성공' };
  }

  @Delete(':groupId')
  async deleteGroup(
    @Param('groupId') groupId: string,
    @Req() req: { session: SessionData },
  ) {
    const credentialId = this.getCredentialId(req);
    await this.service.deleteGroup(credentialId, groupId);
    return { message: '삭제 성공' };
  }
}
