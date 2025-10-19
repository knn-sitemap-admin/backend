import { Body, Controller, Delete, Param, Patch, Req } from '@nestjs/common';
import { ItemService } from './item.service';
import { ReorderFavoriteItemsDto } from './dto/reorder-favorite-items.dto';

@Controller('favorite-groups/:groupId/items')
export class ItemController {
  constructor(private readonly service: ItemService) {}

  @Delete(':itemId')
  async deleteItem(
    @Param('groupId') groupId: string,
    @Param('itemId') itemId: string,
    @Req() req: any,
  ) {
    const accountId = String(req.user.userId);
    await this.service.deleteItem(accountId, groupId, itemId);
    return { message: '삭제 성공' };
  }

  @Patch('reorder')
  async reorderItems(
    @Param('groupId') groupId: string,
    @Body() dto: ReorderFavoriteItemsDto,
    @Req() req: any,
  ) {
    const accountId = String(req.user.userId);
    await this.service.reorderItems(accountId, groupId, dto.orders);
    return { message: '정렬 순서 변경 성공' };
  }
}
