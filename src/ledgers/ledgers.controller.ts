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
import { LedgersService } from './ledgers.service';
import { SessionAuthGuard } from '../dashboard/auth/guards/session-auth.guard';

@Controller('ledgers')
@UseGuards(SessionAuthGuard)
export class LedgersController {
  constructor(private readonly ledgersService: LedgersService) {}

  @Get()
  async findAll(@Req() req: any) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    const data = await this.ledgersService.findAll(credentialId);
    return { message: '가계부 목록 조회 성공', data };
  }

  @Post()
  async create(@Body() dto: any, @Req() req: any) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    const data = await this.ledgersService.create(credentialId, dto);
    return { message: '가계부 내역 생성 완료', data };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    const data = await this.ledgersService.update(id, credentialId, dto);
    return { message: '가계부 내역 수정 완료', data };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    await this.ledgersService.remove(id, credentialId);
    return { message: '가계부 내역 삭제 완료' };
  }
}
