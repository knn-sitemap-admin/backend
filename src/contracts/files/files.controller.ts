import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ContractFilesService } from './files.service';
import { CreateContractFileDto } from './dto/create-file.dto';

@Controller('contracts/:contractId/files')
export class ContractFilesController {
  constructor(private readonly service: ContractFilesService) {}

  @Get()
  async list(@Param('contractId', ParseIntPipe) contractId: number) {
    const data = await this.service.findAll(contractId);
    return { data };
  }

  @Post()
  async create(
    @Param('contractId', ParseIntPipe) contractId: number,
    @Body() dto: CreateContractFileDto,
  ) {
    const data = await this.service.create(contractId, dto);
    return { message: '파일 등록됨', data };
  }

  @Delete(':fileId')
  async remove(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
  ) {
    await this.service.remove(contractId, fileId);
    return { message: '파일 삭제됨', data: null };
  }
}
