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
import { Account } from 'src/dashboard/accounts/entities/account.entity';

type ContractWithCount = Contract & { fileCount: number };

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
        const exists = await manager.getRepository(Account).exist({
          where: { id: String(dto.salespersonAccountId) },
        });
        if (!exists)
          throw new BadRequestException(
            'salespersonAccountId가 유효하지 않습니다.',
          );
        salespersonRef = { id: String(dto.salespersonAccountId) };
      }

      // (옵션) 작성자
      let createdByRef: any = null;
      if (dto.createdByAccountId != null) {
        const exists = await manager.getRepository(Account).exist({
          where: { id: String(dto.createdByAccountId) },
        });
        if (!exists)
          throw new BadRequestException(
            'createdByAccountId가 유효하지 않습니다.',
          );
        createdByRef = { id: String(dto.createdByAccountId) };
      }

      // 계약 저장 (고객 + 금액 + 메인담당자 FK)
      const entity = contractRepo.create({
        pinId: dto.pinId ?? null,

        customerName: dto.customerName ?? null,
        customerPhone: dto.customerPhone ?? null,

        brokerageFee: dto.brokerageFee,
        vat: dto.vat,
        brokerageTotal: dto.brokerageTotal,
        rebateTotal: dto.rebateTotal,
        supportAmount: dto.supportAmount,
        isTaxed: dto.isTaxed,
        calcMemo: dto.calcMemo ?? null,
        grandTotal: dto.grandTotal,

        salesperson: salespersonRef,
        createdBy: createdByRef,
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

  // 파일 개수 포함 반환용 타입

  async findAll(
    dto: ListContractsDto,
  ): Promise<{ items: ContractWithCount[]; total: number }> {
    try {
      const page = Number.isInteger(dto.page) && dto.page! > 0 ? dto.page! : 1;
      const sizeRaw =
        Number.isInteger(dto.size) && dto.size! > 0 ? dto.size! : 20;
      const size = Math.min(Math.max(sizeRaw, 1), 100);

      const orderByProp =
        dto.orderBy === 'created_at' ? 'c.createdAt' : 'c.contractDate';
      const orderDir: 'ASC' | 'DESC' = dto.orderDir === 'ASC' ? 'ASC' : 'DESC';

      const baseQb = this.contractRepository
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.salesperson', 'sp');

      // ---- 필터들 ----
      if (typeof dto.pinId === 'number') {
        baseQb.andWhere('c.pinId = :pinId', { pinId: dto.pinId });
      }
      if (dto.q?.trim()) {
        baseQb.andWhere('(c.customer_name LIKE :kw OR sp.name LIKE :kw)', {
          kw: `%${dto.q.trim()}%`,
        });
      }
      if (dto.dateFrom)
        baseQb.andWhere('c.contract_date >= :df', { df: dto.dateFrom });
      if (dto.dateTo)
        baseQb.andWhere('c.contract_date <= :dt', { dt: dto.dateTo });
      if (dto.status) baseQb.andWhere('c.status = :st', { st: dto.status });

      if (typeof dto.assigneeId === 'number') {
        baseQb.andWhere(
          `EXISTS (
           SELECT 1 FROM contract_assignees a
           WHERE a.contract_id = c.id AND a.account_id = :aid
         )`,
          { aid: dto.assigneeId },
        );
      }

      if (typeof dto.hasFiles === 'boolean') {
        if (dto.hasFiles) {
          baseQb.andWhere(
            `EXISTS (SELECT 1 FROM contract_files f WHERE f.contract_id = c.id)`,
          );
        } else {
          baseQb.andWhere(
            `NOT EXISTS (SELECT 1 FROM contract_files f WHERE f.contract_id = c.id)`,
          );
        }
      }

      // ---- 분리 쿼리: 데이터 / 카운트 (TypeORM 버그 회피) ----
      const dataQb = baseQb
        .clone()
        .orderBy(orderByProp, orderDir)
        .skip((page - 1) * size)
        .take(size);

      const countQb = baseQb
        .clone()
        .orderBy() // 카운트에는 정렬 제거
        .skip(0)
        .take(0);

      const [items, total] = await Promise.all([
        dataQb.getMany(),
        countQb.getCount(),
      ]);

      // ---- 파일 개수 매핑 (의존성 리포지토리 한 방 그룹쿼리) ----
      if (items.length > 0) {
        const ids = items.map((c) => c.id);

        // this.fileRepository 는 @InjectRepository(ContractFile) 로 주입되어 있어야 함
        const rows = await this.fileRepository
          .createQueryBuilder('f')
          .select('f.contract_id', 'contractId')
          .addSelect('COUNT(*)', 'cnt')
          .where('f.contract_id IN (:...ids)', { ids })
          .groupBy('f.contract_id')
          .getRawMany<{ contractId: string; cnt: string }>();

        const countMap = new Map<number, number>(
          rows.map((r) => [Number(r.contractId), Number(r.cnt)]),
        );

        for (const it of items as ContractWithCount[]) {
          it.fileCount = countMap.get(it.id) ?? 0;
        }
      }

      return { items: items as ContractWithCount[], total };
    } catch (err) {
      console.error('findAll() 에러:', err);
      throw new Error(
        `계약 목록 조회 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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
    id = Number(id);
    if (!Number.isInteger(id))
      throw new BadRequestException('id는 number여야 합니다.');

    const found = await this.contractRepository.findOne({ where: { id } });
    if (!found) throw new NotFoundException('계약을 찾을 수 없습니다.');

    const accountRepo = this.dataSource.getRepository(Account);

    let salespersonRel: Account | null | undefined = undefined;
    if (dto.salespersonAccountId !== undefined) {
      if (dto.salespersonAccountId === null) {
        salespersonRel = null;
      } else {
        const acct = await accountRepo.findOne({
          where: { id: String(dto.salespersonAccountId) },
        });
        if (!acct)
          throw new BadRequestException(
            'salespersonAccountId가 유효하지 않습니다.',
          );
        salespersonRel = acct;
      }
    }

    let createdByRel: Account | null | undefined = undefined;
    if (dto.createdByAccountId !== undefined) {
      if (dto.createdByAccountId === null) {
        createdByRel = null;
      } else {
        const acct = await accountRepo.findOne({
          where: { id: String(dto.createdByAccountId) },
        });
        if (!acct)
          throw new BadRequestException(
            'createdByAccountId가 유효하지 않습니다.',
          );
        createdByRel = acct;
      }
    }

    // 스칼라 + relation 머지
    const toSave: Partial<Contract> = {
      id,
      pinId: dto.pinId ?? found.pinId,

      customerName: dto.customerName ?? found.customerName,
      customerPhone: dto.customerPhone ?? found.customerPhone,

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
    };

    if (salespersonRel !== undefined) toSave.salesperson = salespersonRel;
    if (createdByRel !== undefined) toSave.createdBy = createdByRel;

    await this.contractRepository.save(toSave);
    return id;
  }

  async remove(id: number): Promise<void> {
    if (!Number.isInteger(id))
      throw new BadRequestException('id는 number여야 합니다.');
    await this.contractRepository.delete({ id });
  }
}
