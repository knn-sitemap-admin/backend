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
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ListContractsDto } from './dto/list-contracts.dto';

type SessionUser = {
  credentialId: string;
  role: 'admin' | 'manager' | 'staff';
  deviceType: 'pc' | 'mobile';
};

type SessionData = {
  user?: SessionUser;
};

@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Post()
  async create(
    @Req() req: { session: SessionData },
    @Body() dto: CreateContractDto,
  ) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    const data = await this.service.create(credentialId, dto);
    return { message: '계약 생성됨', data };
  }

  // 전체 리스트(관리자/매니저)
  @Get()
  async listAll(
    @Req() req: { session: SessionData },
    @Query() dto: ListContractsDto,
  ) {
    const role = (req.session?.user?.role ?? 'staff') as
      | 'admin'
      | 'manager'
      | 'staff';
    const data = await this.service.listAll(role, dto);
    return { data };
  }

  // 내 리스트(내가 생성 or 참여)
  @Get('me')
  async listMe(
    @Req() req: { session: SessionData },
    @Query() dto: ListContractsDto,
  ) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    const data = await this.service.listMe(credentialId, dto);
    return { data };
  }

  // 상세(id)
  @Get(':id')
  async detailById(
    @Req() req: { session: SessionData },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    const role = (req.session?.user?.role ?? 'staff') as
      | 'admin'
      | 'manager'
      | 'staff';
    const data = await this.service.getDetailById(credentialId, role, id);
    return { data };
  }

  // 상세(contractNo)
  @Get('no/:contractNo')
  async detailByNo(
    @Req() req: { session: SessionData },
    @Param('contractNo') contractNo: string,
  ) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    const role = (req.session?.user?.role ?? 'staff') as
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
    @Req() req: { session: SessionData },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
  ) {
    const credentialId = String(req.session?.user?.credentialId ?? '');
    const role = (req.session?.user?.role ?? 'staff') as
      | 'admin'
      | 'manager'
      | 'staff';
    const data = await this.service.update(credentialId, role, id, dto);
    return { message: '계약 수정됨', data };
  }

  @Delete(':id')
  async remove(
    @Req() req: { session: SessionData },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const role = (req.session?.user?.role ?? 'staff') as
      | 'admin'
      | 'manager'
      | 'staff';
    await this.service.remove(role, id);
    return { message: '계약 삭제됨', data: null };
  }
}
