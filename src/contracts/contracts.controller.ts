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
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ListContractsDto } from './dto/list-contracts.dto';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Post()
  async create(@Body() dto: CreateContractDto) {
    const id = await this.service.create(dto);
    return { message: '계약 생성됨', data: { id } };
  }

  @Get()
  async list(@Query() dto: ListContractsDto) {
    const data = await this.service.findAll(dto);
    return { data };
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Patch(':id')
  async patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
  ) {
    const data = await this.service.update(id, dto);
    return { message: '계약 수정됨', data: { id: data } };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: '계약 삭제됨', data: null };
  }
}
