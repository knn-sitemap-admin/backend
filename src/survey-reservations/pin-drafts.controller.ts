import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { CreatePinDraftDto } from './dto/create-pin-draft.dto';
import { PinDraftsService } from './pin-drafts.service';

@Controller('pin-drafts')
export class PinDraftsController {
  constructor(private readonly service: PinDraftsService) {}

  /**
   * @remarks
   * https://www.notion.so/2858186df78b8099bd67d5fb665f27c2?source=copy_link
   * 임시핀 생성 API
   */
  @Post()
  async create(@Body() dto: CreatePinDraftDto, @Req() req: any) {
    const me = String(req.user?.id ?? req.session?.user?.credentialId ?? '');

    try {
      const data = await this.service.create(dto, me || null);
      return { message: '임시핀 생성', data };
    } catch (err: any) {
      // 요청값 로깅 (민감정보 없으니 그대로)
      console.error('[PinDraftsController.create] ERROR');
      console.error('meCredentialId:', me || null);
      console.error('dto:', dto);

      // Nest/TypeORM 에러 상세
      console.error('err.name:', err?.name);
      console.error('err.message:', err?.message);
      if (err?.response) console.error('err.response:', err.response);
      if (err?.stack) console.error(err.stack);

      // driverError가 있으면 더 자세히
      const d = err?.driverError;
      if (d) {
        console.error('driverError.code:', d.code);
        console.error('driverError.errno:', d.errno);
        console.error('driverError.sqlState:', d.sqlState);
        console.error('driverError.sqlMessage:', d.sqlMessage);
      }

      throw err;
    }
  }

  @Get(':id')
  async getDraftDetail(@Param('id') id: string) {
    const data = await this.service.findDraftDetail(id);
    return { message: '임시핀 상세', data };
  }

  @Delete(':id')
  async deleteDraft(@Param('id') id: string) {
    const result = await this.service.deleteDraftWithReservations(id);

    return {
      message: '임시핀 삭제 완료',
      data: result,
    };
  }
}
