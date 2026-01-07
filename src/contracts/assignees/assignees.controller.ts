// import {
//   Body,
//   Controller,
//   Delete,
//   Get,
//   Param,
//   ParseIntPipe,
//   Patch,
//   Post,
// } from '@nestjs/common';
// import { ContractAssigneesService } from './assignees.service';
// import { CreateContractAssigneeDto } from './dto/create-assignee.dto';
// import { UpdateContractAssigneeDto } from './dto/update-assignee.dto';
//
// @Controller('contracts/:contractId/assignees')
// export class ContractAssigneesController {
//   constructor(private readonly service: ContractAssigneesService) {}
//
//   @Get()
//   async list(@Param('contractId', ParseIntPipe) contractId: number) {
//     const data = await this.service.findAll(contractId);
//     return { data };
//   }
//
//   @Post()
//   async create(
//     @Param('contractId', ParseIntPipe) contractId: number,
//     @Body() dto: CreateContractAssigneeDto,
//   ) {
//     const data = await this.service.create(contractId, dto);
//     return { message: '담당자 추가됨', data };
//   }
//
//   @Patch(':assigneeId')
//   async patch(
//     @Param('contractId', ParseIntPipe) contractId: number,
//     @Param('assigneeId', ParseIntPipe) assigneeId: number,
//     @Body() dto: UpdateContractAssigneeDto,
//   ) {
//     const data = await this.service.update(contractId, assigneeId, dto);
//     return { message: '담당자 수정됨', data };
//   }
//
//   @Delete(':assigneeId')
//   async remove(
//     @Param('contractId', ParseIntPipe) contractId: number,
//     @Param('assigneeId', ParseIntPipe) assigneeId: number,
//   ) {
//     await this.service.remove(contractId, assigneeId);
//     return { message: '담당자 삭제됨', data: null };
//   }
// }
