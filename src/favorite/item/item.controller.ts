import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { SessionData } from 'express-session';
import { ItemService } from './item.service';
import { ReorderFavoriteItemsDto } from './dto/reorder-favorite-items.dto';
import { SessionAuthGuard } from '../../dashboard/auth/guards/session-auth.guard';

@Controller('favorite-groups/:groupId/items')
@UseGuards(SessionAuthGuard)
export class ItemController {
  constructor(private readonly service: ItemService) {}

  private getCredentialId(req: { session: SessionData }): string {
    const credentialId = String((req.session as any)?.user?.credentialId ?? '');
    if (!credentialId) throw new UnauthorizedException('로그인이 필요합니다');
    return credentialId;
  }

  @Delete(':itemId')
  async deleteItem(
    @Param('groupId') groupId: string,
    @Param('itemId') itemId: string,
    @Req() req: { session: SessionData },
  ) {
    const credentialId = this.getCredentialId(req);
    await this.service.deleteItem(credentialId, groupId, itemId);
    return { message: '삭제 성공' };
  }

  @Patch('reorder')
  async reorderItems(
    @Param('groupId') groupId: string,
    @Body() dto: ReorderFavoriteItemsDto,
    @Req() req: { session: SessionData },
  ) {
    const credentialId = this.getCredentialId(req);
    await this.service.reorderItems(credentialId, groupId, dto.orders);
    return { message: '정렬 순서 변경 성공' };
  }
}
