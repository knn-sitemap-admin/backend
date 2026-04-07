import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { NoticesService } from './notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { SessionAuthGuard } from '../dashboard/auth/guards/session-auth.guard';
import { RolesGuard } from '../dashboard/auth/guards/roles.guard';
import { Roles } from '../dashboard/auth/decorators/roles.decorator';
import { SystemRole } from '../dashboard/accounts/types/roles';

type SessionUser = {
  credentialId: string;
  role: SystemRole;
};

type SessionData = {
  user?: SessionUser;
};

@Controller('dashboard/notices')
@UseGuards(SessionAuthGuard, RolesGuard)
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  async create(
    @Req() req: { session: SessionData },
    @Body() createNoticeDto: CreateNoticeDto,
  ) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    const data = await this.noticesService.create(credentialId, createNoticeDto);
    return { message: '공지사항이 생성되었습니다.', data };
  }

  @Get()
  async findAll() {
    const data = await this.noticesService.findAll();
    return { data };
  }

  @Get(':id')
  async findOne(
    @Req() req: { session: SessionData },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    const data = await this.noticesService.findOne(id, credentialId);
    return { data };
  }

  @Get(':id/read-status')
  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  async getReadStatus(@Param('id', ParseIntPipe) id: number) {
    const data = await this.noticesService.getReadStatus(id);
    return { data };
  }

  @Patch(':id')
  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateNoticeDto: UpdateNoticeDto,
  ) {
    const data = await this.noticesService.update(id, updateNoticeDto);
    return { message: '공지사항이 수정되었습니다.', data };
  }

  @Delete(':id')
  @Roles(SystemRole.ADMIN, SystemRole.MANAGER)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.noticesService.remove(id);
    return { message: '공지사항이 삭제되었습니다.', data: null };
  }
}
