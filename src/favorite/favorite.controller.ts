import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { UpsertFavoriteItemDto } from './dto/upsert-favorite-item.dto';
import { FavoriteService } from './favorite.service';
import { SessionAuthGuard } from 'src/dashboard/auth/guards/session-auth.guard';

@UseGuards(SessionAuthGuard)
@Controller('favorite')
export class FavoriteController {
  constructor(private readonly service: FavoriteService) {}

  @Post('upsert-item')
  async upsertItem(@Body() dto: UpsertFavoriteItemDto, @Req() req: any) {
    const credId = req.user?.credentialId ?? req.session?.user?.credentialId;

    const data = await this.service.upsertItem(credId, dto);
    return { message: '저장 성공', data };
  }
}
