import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ListContractsDto } from './dto/list-contracts.dto';
import { SessionAuthGuard } from '../dashboard/auth/guards/session-auth.guard';

@Controller('contracts')
@UseGuards(SessionAuthGuard)
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Post()
  async create(
    @Req() req: any,
    @Body() dto: CreateContractDto,
  ) {
    const credentialId = String(req.user?.credentialId ?? req.session?.user?.credentialId ?? '');
    const data = await this.service.create(credentialId, dto);
    return { message: '계약 생성됨', data };
  }

  @Get('filter-options')
  async getFilterOptions() {
    const data = await this.service.getFilterOptions();
    return { data };
  }

  // 전체 리스트(관리자/매니저)
  @Get()
  async listAll(
    @Req() req: any,
    @Query() dto: ListContractsDto,
  ) {
    const role = (req.user?.role ?? req.session?.user?.role ?? 'staff') as
      | 'admin'
      | 'manager'
      | 'staff';
    const data = await this.service.listAll(role, dto);
    return { data };
  }

  // 내 리스트(내가 생성 or 참여)
  @Get('me')
  async listMe(
    @Req() req: any,
    @Query() dto: ListContractsDto,
  ) {
    const credentialId = String(req.user?.credentialId ?? req.session?.user?.credentialId ?? '');
    const role = (req.user?.role ?? req.session?.user?.role ?? 'staff') as
      | 'admin'
      | 'manager'
      | 'staff';
    const data = await this.service.listMe(credentialId, role, dto);
    return { data };
  }

  // 상세(id)
  @Get(':id')
  async detailById(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const credentialId = String(req.user?.credentialId ?? req.session?.user?.credentialId ?? '');
    const role = (req.user?.role ?? req.session?.user?.role ?? 'staff') as
      | 'admin'
      | 'manager'
      | 'staff';
    const data = await this.service.getDetailById(credentialId, role, id);
    return { data };
  }

  // 상세(contractNo)
  @Get('no/:contractNo')
  async detailByNo(
    @Req() req: any,
    @Param('contractNo') contractNo: string,
  ) {
    const credentialId = String(req.user?.credentialId ?? req.session?.user?.credentialId ?? '');
    const role = (req.user?.role ?? req.session?.user?.role ?? 'staff') as
      | 'admin'
      | 'manager'
      | 'staff';
    const data = await this.service.getDetailByContractNo(
      credentialId,
      role,
      contractNo,
    );
    return { data };
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
  ) {
    const credentialId = String(req.user?.credentialId ?? req.session?.user?.credentialId ?? '');
    const role = (req.user?.role ?? req.session?.user?.role ?? 'staff') as
      | 'admin'
      | 'manager'
      | 'staff';
    const data = await this.service.update(credentialId, role, id, dto);
    return { message: '계약 수정됨', data };
  }

  @Delete(':id')
  async remove(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const role = (req.user?.role ?? req.session?.user?.role ?? 'staff') as
      | 'admin'
      | 'manager'
      | 'staff';
    await this.service.remove(role, id);
    return { message: '계약 삭제됨', data: null };
  }
}
