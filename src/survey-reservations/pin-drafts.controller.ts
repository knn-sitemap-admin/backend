import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreatePinDraftDto } from './dto/create-pin-draft.dto';
import { PinDraftsService } from './pin-drafts.service';
import { SessionAuthGuard } from 'src/dashboard/auth/guards/session-auth.guard';

@UseGuards(SessionAuthGuard)
@Controller('pin-drafts')
export class PinDraftsController {
  private readonly logger = new Logger(PinDraftsController.name);

  constructor(private readonly service: PinDraftsService) {}

  /**
   * @remarks
   * https://www.notion.so/2858186df78b8099bd67d5fb665f27c2?source=copy_link
   * 임시핀 생성 API
   */
  @Post()
  async create(@Body() dto: CreatePinDraftDto, @Req() req: any) {
    const me = String(req.user?.credentialId ?? req.session?.user?.credentialId ?? '');

    try {
      const data = await this.service.create(dto, me || null);
      return { message: '임시핀 생성', data };
    } catch (err: any) {
      // 요청값 로깅 (민감정보 없으니 그대로)
      this.logger.error('[PinDraftsController.create] ERROR', {
        meCredentialId: me || null,
        dto,
        error: {
          name: err?.name,
          message: err?.message,
          response: err?.response,
          stack: err?.stack,
          driverError: err?.driverError,
        },
      });

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
