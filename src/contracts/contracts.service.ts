import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ListContractsDto } from './dto/list-contracts.dto';
import { Contract } from './entities/contract.entity';
import { ContractFile } from './files/entities/file.entity';
import { ContractAssigneesService } from './assignees/assignees.service';

@Injectable()
export class ContractsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ContractFile)
    private readonly fileRepository: Repository<ContractFile>,
    private readonly assigneesService: ContractAssigneesService,
  ) {}

  // 숫자 필드 빠른 검증
  private assertNumbers(...pairs: Array<[any, string]>) {
    const bad = pairs.find(([v]) => typeof v !== 'number' || Number.isNaN(v));
    if (bad) throw new BadRequestException(`${bad[1]}는 number여야 합니다.`);
  }

  async create(dto: CreateContractDto): Promise<number> {
    // 1) 숫자/불리언 최소 검증
    this.assertNumbers(
      [dto.brokerageFee, 'brokerageFee'],
      [dto.vat, 'vat'],
      [dto.brokerageTotal, 'brokerageTotal'],
      [dto.rebateTotal, 'rebateTotal'],
      [dto.supportAmount, 'supportAmount'],
      [dto.grandTotal, 'grandTotal'],
    );
    if (typeof dto.isTaxed !== 'boolean') {
      throw new BadRequestException('isTaxed는 boolean이어야 합니다.');
    }

    // 2) 트랜잭션
    const id = await this.dataSource.transaction(async (manager) => {
      const contractRepo = manager.getRepository(Contract);

      // (선택) 메인 담당자 FK 유효성 검사
      let salespersonRef: any = null;
      if (dto.salespersonAccountId != null) {
        // 존재여부만 체크 (accounts 모듈의 Entity 이름에 맞춰 테이블명/리포지토리 사용)
        const exists = await manager
          .getRepository('accounts') // 또는 Account 엔티티가 있으면 getRepository(Account)
          .exist({ where: { id: dto.salespersonAccountId } as any });
        if (!exists) {
          throw new BadRequestException(
            'salespersonAccountId가 유효하지 않습니다.',
          );
        }
        salespersonRef = { id: dto.salespersonAccountId };
      }

      // 계약 저장 (고객 + 금액 + 메인담당자 FK)
      const entity = contractRepo.create({
        pinId: dto.pinId ?? null,

        customerName: dto.customerName ?? null,
        customerPhone: dto.customerPhone ?? null,

        // ✅ 새 엔티티에 맞게: 문자열 담당자/분배처 필드는 저장하지 않음
        // salespersonName / salespersonPhone / distributor* 제거

        brokerageFee: dto.brokerageFee,
        vat: dto.vat,
        brokerageTotal: dto.brokerageTotal,
        rebateTotal: dto.rebateTotal,
        supportAmount: dto.supportAmount,
        isTaxed: dto.isTaxed,
        calcMemo: dto.calcMemo ?? null,
        grandTotal: dto.grandTotal,

        salesperson: salespersonRef, // ✅ FK로 연결
        contractDate: dto.contractDate ?? new Date().toISOString().slice(0, 10),
        status: dto.status ?? 'ongoing',
      });

      const saved = await contractRepo.save(entity);

      // 파일 메타 저장 (그대로 유지)
      if (dto.urls?.length) {
        const fRepo = manager.getRepository(ContractFile);
        const metas = dto.urls.map((url) =>
          fRepo.create({ contractId: saved.id, url, filename: null }),
        );
        await fRepo.save(metas);
      }

      // 담당자 분배 저장 (기존 방식 유지)
      if (dto.assignees?.length) {
        await this.assigneesService.bulkCreateWithManager(
          manager,
          saved.id,
          dto.assignees,
          dto.grandTotal,
        );
      }

      return saved.id;
    });

    return id;
  }

  async findAll(
    dto: ListContractsDto,
  ): Promise<{ items: Contract[]; total: number }> {
    const page = Number.isInteger(dto.page) && dto.page! > 0 ? dto.page! : 1;
    const sizeRaw =
      Number.isInteger(dto.size) && dto.size! > 0 ? dto.size! : 20;
    const size = Math.min(Math.max(sizeRaw, 1), 100);

    const orderBy =
      dto.orderBy === 'created_at' ? 'c.created_at' : 'c.contract_date';
    const orderDir = dto.orderDir === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.contractRepository
      .createQueryBuilder('c')
      // 메인 담당자 JOIN (이름/팀 표시 & 검색용)
      .leftJoinAndSelect('c.salesperson', 'sp')
      // 파일 유무 필터/표시용
      .leftJoin('contract_files', 'f', 'f.contract_id = c.id')
      .take(size)
      .skip((page - 1) * size)
      .orderBy(orderBy, orderDir);

    // pinId
    if (typeof dto.pinId === 'number') {
      qb.andWhere('c.pin_id = :pinId', { pinId: dto.pinId });
    }

    // 검색어: 고객명 + 메인담당자명(계정 테이블 기준)
    if (dto.q && dto.q.trim() !== '') {
      qb.andWhere('(c.customer_name LIKE :kw OR sp.name LIKE :kw)', {
        kw: `%${dto.q.trim()}%`,
      });
    }

    // 계약일 범위
    if (dto.dateFrom)
      qb.andWhere('c.contract_date >= :df', { df: dto.dateFrom });
    if (dto.dateTo) qb.andWhere('c.contract_date <= :dt', { dt: dto.dateTo });

    // 상태
    if (dto.status) qb.andWhere('c.status = :st', { st: dto.status });

    // 특정 분배참여자(account_id) 조건
    if (typeof dto.assigneeId === 'number') {
      qb.andWhere(
        `EXISTS (
         SELECT 1 FROM contract_assignees a
         WHERE a.contract_id = c.id AND a.account_id = :aid
       )`,
        { aid: dto.assigneeId },
      );
    }

    // 파일 유무
    if (typeof dto.hasFiles === 'boolean') {
      if (dto.hasFiles) qb.andWhere('f.id IS NOT NULL');
      else qb.andWhere('f.id IS NULL');
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(id: number): Promise<Contract> {
    if (!Number.isInteger(id)) {
      throw new BadRequestException('id는 number여야 합니다.');
    }
    const data = await this.contractRepository.findOne({
      where: { id },
      relations: ['salesperson'], // 담당자 표시용
    });
    if (!data) throw new NotFoundException('계약을 찾을 수 없습니다.');
    return data;
  }

  async update(id: number, dto: UpdateContractDto): Promise<number> {
    if (!Number.isInteger(id)) {
      throw new BadRequestException('id는 number여야 합니다.');
    }
    const found = await this.contractRepository.findOne({ where: { id } });
    if (!found) throw new NotFoundException('계약을 찾을 수 없습니다.');

    // 메인 담당자 FK 설정(옵션)
    let salespersonRef: any = found.salesperson ?? null;
    if (dto.salespersonAccountId !== undefined) {
      if (dto.salespersonAccountId === null) {
        salespersonRef = null;
      } else {
        const exists = await this.dataSource
          .getRepository('accounts') // 또는 Account 엔티티
          .exist({ where: { id: dto.salespersonAccountId } });
        if (!exists)
          throw new BadRequestException(
            'salespersonAccountId가 유효하지 않습니다.',
          );
        salespersonRef = { id: dto.salespersonAccountId };
      }
    }

    await this.contractRepository.update(
      { id },
      {
        pinId: dto.pinId ?? found.pinId,

        customerName: dto.customerName ?? found.customerName,
        customerPhone: dto.customerPhone ?? found.customerPhone,

        // 문자열 담당자/분배처는 더 이상 저장하지 않음

        brokerageFee: dto.brokerageFee ?? found.brokerageFee,
        vat: dto.vat ?? found.vat,
        brokerageTotal: dto.brokerageTotal ?? found.brokerageTotal,
        rebateTotal: dto.rebateTotal ?? found.rebateTotal,
        supportAmount: dto.supportAmount ?? found.supportAmount,

        isTaxed: typeof dto.isTaxed === 'boolean' ? dto.isTaxed : found.isTaxed,
        calcMemo: dto.calcMemo ?? found.calcMemo,

        contractDate: dto.contractDate ?? found.contractDate,
        status: dto.status ?? found.status,

        grandTotal: dto.grandTotal ?? found.grandTotal,

        salesperson: salespersonRef,
      },
    );

    return id;
  }

  async remove(id: number): Promise<void> {
    if (!Number.isInteger(id))
      throw new BadRequestException('id는 number여야 합니다.');
    await this.contractRepository.delete({ id });
  }
}
