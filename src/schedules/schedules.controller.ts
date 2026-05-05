import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto, UpdateScheduleDto, ScheduleQueryDto } from './dto/schedule.dto';
import { SessionAuthGuard } from '../dashboard/auth/guards/session-auth.guard';

@Controller('schedules')
@UseGuards(SessionAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) { }

  @Get()
  async findAll(@Query() query: ScheduleQueryDto) {
    return this.schedulesService.list(query);
  }

  @Get('deleted')
  async findDeleted(@Req() req: any) {
    const credId = req.user?.credentialId ?? req.session?.user?.credentialId;
    const role = req.user?.role ?? req.session?.user?.role ?? 'staff';
    return this.schedulesService.listDeleted(credId, role);
  }

  @Post()
  async create(@Body() dto: CreateScheduleDto, @Req() req: any) {
    const credId = req.user?.credentialId ?? req.session?.user?.credentialId;
    const role = req.user?.role ?? req.session?.user?.role ?? 'staff';
    return this.schedulesService.create(dto, credId, role);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleDto,
    @Req() req: any,
  ) {
    const credId = req.user?.credentialId ?? req.session?.user?.credentialId;
    const role = req.user?.role ?? req.session?.user?.role ?? 'staff';
    return this.schedulesService.update(id, dto, credId, role);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const credId = req.user?.credentialId ?? req.session?.user?.credentialId;
    const role = req.user?.role ?? req.session?.user?.role ?? 'staff';
    return this.schedulesService.delete(id, credId, role);
  }

  @Post(':id/restore')
  async restore(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const credId = req.user?.credentialId ?? req.session?.user?.credentialId;
    const role = req.user?.role ?? req.session?.user?.role ?? 'staff';
    return this.schedulesService.restore(id, credId, role);
  }
}
