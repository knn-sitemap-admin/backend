import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { SurveyReservationsService } from './survey-reservations.service';
import { CreateSurveyReservationDto } from './dto/create-survey-reservation.dto';
import { ReorderSurveyReservationsDto } from './dto/reorder-survey-reservations.dto';

@Controller('survey-reservations')
export class SurveyReservationsController {
  constructor(
    private readonly surveyReservationsService: SurveyReservationsService,
  ) {}

  @Get('before')
  async listBefore() {
    const data = await this.surveyReservationsService.listBefore();
    return { message: '답사전 목록', data };
  }

  @Get('scheduled')
  async listScheduled(@Req() req: any) {
    const me = String(req.user?.id ?? req.session?.user?.credentialId ?? '');
    const data = await this.surveyReservationsService.listScheduled(me);
    return { message: '내 답사예정 목록', data };
  }

  @Post()
  async create(@Body() dto: CreateSurveyReservationDto, @Req() req: any) {
    const me = String(req.user?.id ?? req.session?.user?.credentialId ?? '');
    const data = await this.surveyReservationsService.create(me, dto);
    return { message: '예약 생성됨', data };
  }

  @Delete(':id')
  async cancel(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const me = String(req.user?.id ?? req.session?.user?.credentialId ?? '');
    const data = await this.surveyReservationsService.cancel(id, me);
    return { message: '예약 취소됨', data };
  }

  @Patch('reorder')
  async reorder(@Body() dto: ReorderSurveyReservationsDto, @Req() req: any) {
    const me = String(req.user?.id ?? req.session?.user?.credentialId ?? '');
    const data = await this.surveyReservationsService.reorder(me, dto);
    return { message: '예약 순서가 변경되었습니다.', data };
  }
}
