import { Body, Controller, Post } from '@nestjs/common';
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
  async create(@Body() dto: CreatePinDraftDto) {
    const data = await this.service.create(dto);
    return { message: '임시핀 생성', data };
  }
}
