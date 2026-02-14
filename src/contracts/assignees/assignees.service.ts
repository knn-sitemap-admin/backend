// import {
//   BadRequestException,
//   Injectable,
//   NotFoundException,
// } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { EntityManager, Repository } from 'typeorm';
// import { ContractAssignee } from './entities/assignee.entity';
// import { CreateContractAssigneeDto } from './dto/create-assignee.dto';
// import { UpdateContractAssigneeDto } from './dto/update-assignee.dto';
// import { Account } from '../../dashboard/accounts/entities/account.entity';
// import { Contract } from '../entities/contract.entity';
//
// @Injectable()
// export class ContractAssigneesService {
//   constructor(
//     @InjectRepository(ContractAssignee)
//     private readonly contractAssigneeRepository: Repository<ContractAssignee>,
//   ) {}
//
//   async findAll(contractId: number) {
//     return this.contractAssigneeRepository.find({
//       where: { contract: { id: contractId } },
//       relations: ['account'],
//       order: { sortOrder: 'ASC', id: 'ASC' },
//     });
//   }
//
//   async create(contractId: number, dto: CreateContractAssigneeDto) {
//     const entity = this.contractAssigneeRepository.create({
//       contract: { id: contractId } as Contract,
//       account:
//         dto.accountId != null
//           ? ({ id: String(dto.accountId) } as Account)
//           : null,
//       role: dto.role,
//       sharePercent: dto.sharePercent ?? 0,
//       rebateAmount: dto.rebateAmount ?? 0,
//       finalAmount: dto.finalAmount ?? 0,
//       isManual: dto.isManual ?? false,
//       sortOrder: dto.sortOrder ?? 0,
//     });
//     const saved = await this.contractAssigneeRepository.save(entity);
//     return { id: saved.id };
//   }
//
//   async bulkCreateWithManager(
//     manager: EntityManager,
//     contractId: number | string,
//     assignees: Array<{
//       accountId?: string | null;
//       role: 'company' | 'staff';
//       sharePercent: number;
//       rebateAmount?: number;
//       finalAmount?: number;
//       isManual?: boolean;
//       sortOrder?: number;
//     }>,
//     grandTotal: number,
//   ): Promise<void> {
//     if (!assignees?.length) return;
//
//     const sum = assignees.reduce((s, a) => s + (a.sharePercent ?? 0), 0);
//     if (Math.abs(sum - 100) > 0.0001) {
//       throw new BadRequestException('담당자 비율 합계가 100%가 아닙니다.');
//     }
//
//     const repo = manager.getRepository(ContractAssignee);
//
//     const rows = assignees.map((a) => {
//       const autoFinal =
//         a.finalAmount ?? Math.round(grandTotal * ((a.sharePercent ?? 0) / 100));
//
//       return repo.create({
//         contract: { id: contractId } as any,
//         account:
//           a.accountId != null ? ({ id: String(a.accountId) } as any) : null,
//         role: a.role,
//         sharePercent: a.sharePercent ?? 0,
//         rebateAmount: a.rebateAmount ?? 0,
//         finalAmount: autoFinal,
//         isManual: a.isManual ?? false,
//         sortOrder: a.sortOrder ?? 0,
//       });
//     });
//
//     const diff =
//       grandTotal - rows.reduce((s, r) => s + (r.finalAmount || 0), 0);
//     if (rows.length && diff !== 0) rows[rows.length - 1].finalAmount += diff;
//
//     await repo.save(rows);
//   }
//
//   async update(
//     contractId: number,
//     assigneeId: number,
//     dto: UpdateContractAssigneeDto,
//   ) {
//     const found = await this.contractAssigneeRepository.findOne({
//       where: { id: assigneeId, contract: { id: contractId } },
//       relations: ['account', 'contract'],
//     });
//     if (!found) throw new NotFoundException('담당자를 찾을 수 없습니다.');
//
//     if (dto.accountId !== undefined) {
//       found.account =
//         dto.accountId == null
//           ? null
//           : ({ id: String(dto.accountId) } as Account);
//     }
//
//     // 스칼라 갱신
//     if (dto.role !== undefined) found.role = dto.role;
//     if (dto.sharePercent !== undefined) found.sharePercent = dto.sharePercent;
//     if (dto.rebateAmount !== undefined) found.rebateAmount = dto.rebateAmount;
//     if (dto.finalAmount !== undefined) found.finalAmount = dto.finalAmount;
//     if (dto.isManual !== undefined) found.isManual = dto.isManual;
//     if (dto.sortOrder !== undefined) found.sortOrder = dto.sortOrder;
//
//     await this.contractAssigneeRepository.save(found);
//     return { id: assigneeId };
//   }
//
//   async remove(contractId: number, assigneeId: number) {
//     const found = await this.contractAssigneeRepository.findOne({
//       where: { id: assigneeId, contract: { id: contractId } },
//     });
//     if (!found) throw new NotFoundException('담당자를 찾을 수 없습니다.');
//     await this.contractAssigneeRepository.delete(assigneeId);
//   }
// }
