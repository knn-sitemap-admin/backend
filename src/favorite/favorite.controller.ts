import { Body, Controller, Post, Req } from '@nestjs/common';
import { UpsertFavoriteItemDto } from './dto/upsert-favorite-item.dto';
import { FavoriteService } from './favorite.service';

@Controller('favorite')
export class FavoriteController {
  constructor(private readonly service: FavoriteService) {}

  @Post('upsert-item')
  async upsertItem(@Body() dto: UpsertFavoriteItemDto, @Req() req: any) {
    const me = String(req.user?.id ?? req.session?.user?.credentialId ?? '');

    const data = await this.service.upsertItem(me, dto);
    return { message: '저장 성공', data };
  }
}
