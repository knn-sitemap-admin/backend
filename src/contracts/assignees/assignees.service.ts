import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractAssignee } from './entities/assignee.entity';
import { CreateContractAssigneeDto } from './dto/create-assignee.dto';
import { UpdateContractAssigneeDto } from './dto/update-assignee.dto';

@Injectable()
export class ContractAssigneesService {
  constructor(
    @InjectRepository(ContractAssignee)
    private readonly contractAssigneeRepository: Repository<ContractAssignee>,
  ) {}

  async findAll(contractId: number) {
    return this.contractAssigneeRepository.find({
      where: { contractId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async create(contractId: number, dto: CreateContractAssigneeDto) {
    const entity = this.contractAssigneeRepository.create({
      contractId,
      accountId: dto.accountId ?? null,
      assigneeName: dto.assigneeName ?? null,
      role: dto.role,
      sharePercent: dto.sharePercent ?? 0,
      rebateAmount: dto.rebateAmount ?? 0,
      finalAmount: dto.finalAmount ?? 0,
      isManual: dto.isManual ?? false,
      sortOrder: dto.sortOrder ?? 0,
    });
    const saved = await this.contractAssigneeRepository.save(entity);
    return { id: saved.id };
  }

  async update(
    contractId: number,
    assigneeId: number,
    dto: UpdateContractAssigneeDto,
  ) {
    const found = await this.contractAssigneeRepository.findOne({
      where: { id: assigneeId, contractId },
    });
    if (!found) throw new NotFoundException('담당자를 찾을 수 없습니다.');

    await this.contractAssigneeRepository.update(
      { id: assigneeId },
      {
        accountId: dto.accountId ?? found.accountId,
        assigneeName: dto.assigneeName ?? found.assigneeName,
        role: dto.role ?? found.role,
        sharePercent: dto.sharePercent ?? found.sharePercent,
        rebateAmount: dto.rebateAmount ?? found.rebateAmount,
        finalAmount: dto.finalAmount ?? found.finalAmount,
        isManual:
          typeof dto.isManual === 'boolean' ? dto.isManual : found.isManual,
        sortOrder: dto.sortOrder ?? found.sortOrder,
      },
    );
    return { id: assigneeId };
  }

  async remove(contractId: number, assigneeId: number) {
    const found = await this.contractAssigneeRepository.findOne({
      where: { id: assigneeId, contractId },
    });
    if (!found) throw new NotFoundException('담당자를 찾을 수 없습니다.');
    await this.contractAssigneeRepository.delete(assigneeId);
  }
}
