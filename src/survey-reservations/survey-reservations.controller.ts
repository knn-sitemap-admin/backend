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
  UseGuards,
} from '@nestjs/common';
import { SurveyReservationsService } from './survey-reservations.service';
import { CreateSurveyReservationDto } from './dto/create-survey-reservation.dto';
import { ReorderSurveyReservationsDto } from './dto/reorder-survey-reservations.dto';
import { SessionAuthGuard } from '../dashboard/auth/guards/session-auth.guard';

@Controller('survey-reservations')
export class SurveyReservationsController {
  constructor(
    private readonly surveyReservationsService: SurveyReservationsService,
  ) {}

  /** 세션 불필요 — 공개 API */
  @Get('before')
  async listBefore() {
    const data = await this.surveyReservationsService.listBefore();
    return { message: '답사전 목록', data };
  }

  @UseGuards(SessionAuthGuard)
  @Get('scheduled')
  async listScheduled(@Req() req: any) {
    const me = String(req.user?.credentialId ?? req.session?.user?.credentialId ?? '');
    const data = await this.surveyReservationsService.listScheduled(me);
    return { message: '답사예정 목록(전체)', data };
  }

  @UseGuards(SessionAuthGuard)
  @Post()
  async create(@Body() dto: CreateSurveyReservationDto, @Req() req: any) {
    const me = String(req.user?.credentialId ?? req.session?.user?.credentialId ?? '');
    const role = req.user?.role ?? req.session?.user?.role ?? '';
    const isPrivileged = role === 'admin' || role === 'manager';
    const data = await this.surveyReservationsService.create(me, dto, isPrivileged);
    return { message: '예약 생성됨', data };
  }

  @UseGuards(SessionAuthGuard)
  @Delete(':id')
  async cancel(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const me = String(req.user?.credentialId ?? req.session?.user?.credentialId ?? '');
    const role = req.user?.role ?? req.session?.user?.role ?? '';
    const isPrivileged = role === 'admin' || role === 'manager';
    const data = await this.surveyReservationsService.cancel(id, me, isPrivileged);
    return { message: '예약 취소됨', data };
  }

  @UseGuards(SessionAuthGuard)
  @Patch('reorder')
  async reorder(@Body() dto: ReorderSurveyReservationsDto, @Req() req: any) {
    const me = String(req.user?.credentialId ?? req.session?.user?.credentialId ?? '');
    const data = await this.surveyReservationsService.reorder(me, dto);
    return { message: '예약 순서가 변경되었습니다.', data };
  }
}
