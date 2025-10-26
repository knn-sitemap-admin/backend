import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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
      relations: ['account'],
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async create(contractId: number, dto: CreateContractAssigneeDto) {
    const entity = this.contractAssigneeRepository.create({
      contractId,
      accountId: dto.accountId ?? null,
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

  // 트랜잭션 재사용용 벌크(ASSIGNEES 배열 저장 + 자동계산/검증 포함)
  async bulkCreateWithManager(
    manager: EntityManager,
    contractId: number | string, // uuid일 수도 있으니 string도 허용
    assignees: Array<{
      accountId?: number | string | null;
      role: 'company' | 'staff';
      sharePercent: number;
      rebateAmount?: number;
      finalAmount?: number;
      isManual?: boolean;
      sortOrder?: number;
    }>,
    grandTotal: number,
  ): Promise<void> {
    if (!assignees?.length) return;

    const sum = assignees.reduce((s, a) => s + (a.sharePercent ?? 0), 0);
    if (Math.abs(sum - 100) > 0.0001) {
      throw new BadRequestException('담당자 비율 합계가 100%가 아닙니다.');
    }

    const repo = manager.getRepository(ContractAssignee);

    const rows = assignees.map((a) => {
      const autoFinal =
        a.finalAmount ?? Math.round(grandTotal * ((a.sharePercent ?? 0) / 100));

      // Account/Contract의 PK 타입에 맞춰 문자열/숫자로 변환
      // - 만약 Account.id가 uuid라면 String(...)로
      // - 만약 number/bigint라면 Number(...)
      const contractRef: any = { id: contractId };
      const accountRef: any = a.accountId != null ? { id: a.accountId } : null;

      return repo.create({
        contract: contractRef,
        account: accountRef,
        role: a.role,
        sharePercent: a.sharePercent ?? 0,
        rebateAmount: a.rebateAmount ?? 0,
        finalAmount: autoFinal,
        isManual: a.isManual ?? false,
        sortOrder: a.sortOrder ?? 0,
      });
    });

    // 반올림 오차 보정
    const diff =
      grandTotal - rows.reduce((s, r) => s + (r.finalAmount || 0), 0);
    if (rows.length && diff !== 0) rows[rows.length - 1].finalAmount += diff;

    await repo.save(rows);
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
