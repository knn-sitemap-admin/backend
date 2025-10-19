import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { GroupService } from './group.service';
import { UpdateFavoriteGroupDto } from './dto/update-group.dto';
import { ReorderFavoriteGroupsDto } from './dto/reorder-favorite-groups.dto';

@Controller('group')
export class GroupController {
  constructor(private readonly service: GroupService) {}

  @Get()
  async getGroups(
    @Query('includeItems') includeItems: string,
    @Req() req: any,
  ) {
    const accountId = String(req.user.userId);
    const withItems = includeItems === '1' || includeItems === 'true';

    const data = await this.service.getGroups(accountId, withItems);
    return { message: '조회 성공', data };
  }

  @Patch(':groupId')
  async updateGroupTitle(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateFavoriteGroupDto,
    @Req() req: any,
  ) {
    const accountId = String(req.user.userId);
    const data = await this.service.updateGroupTitle(
      accountId,
      groupId,
      dto.title,
    );
    return { message: '수정 성공', data };
  }

  @Patch('reorder')
  async reorderGroups(@Body() dto: ReorderFavoriteGroupsDto, @Req() req: any) {
    const accountId = String(req.user.userId);
    await this.service.reorderGroups(accountId, dto.orders);
    return { message: '정렬 순서 변경 성공' };
  }
}
