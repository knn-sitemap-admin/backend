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

@Injectable()
export class ContractsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ContractFile)
    private readonly fileRepository: Repository<ContractFile>,
  ) {}

  async create(dto: CreateContractDto): Promise<number> {
    const req = [
      dto.brokerageFee,
      dto.vat,
      dto.brokerageTotal,
      dto.rebateTotal,
      dto.supportAmount,
      dto.grandTotal,
    ];
    if (req.some((v) => typeof v !== 'number')) {
      throw new BadRequestException('필수 금액 필드는 number여야 합니다.');
    }
    if (typeof dto.isTaxed !== 'boolean') {
      throw new BadRequestException('isTaxed는 boolean이어야 합니다.');
    }

    const id = await this.dataSource.transaction(async (manager) => {
      const contractRepo = manager.getRepository(Contract);

      const entity = contractRepo.create({
        pinId: dto.pinId ?? null,

        customerName: dto.customerName ?? null,
        customerPhone: dto.customerPhone ?? null,

        distributorName: dto.distributorName ?? null,
        distributorPhone: dto.distributorPhone ?? null,

        salespersonName: dto.salespersonName ?? null,
        salespersonPhone: dto.salespersonPhone ?? null,

        brokerageFee: dto.brokerageFee,
        vat: dto.vat,
        brokerageTotal: dto.brokerageTotal,

        rebateTotal: dto.rebateTotal,
        supportAmount: dto.supportAmount,

        isTaxed: dto.isTaxed,
        calcMemo: dto.calcMemo ?? null,

        grandTotal: dto.grandTotal,
      });

      const saved = await contractRepo.save(entity);

      if (dto.urls?.length) {
        const fRepo = manager.getRepository(ContractFile);
        const metas = dto.urls.map((url) =>
          fRepo.create({
            contractId: saved.id,
            url,
            filename: null,
          }),
        );
        await fRepo.save(metas);
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

    const qb = this.contractRepository
      .createQueryBuilder('c')
      .leftJoin('contract_files', 'f', 'f.contract_id = c.id')
      .take(size)
      .skip((page - 1) * size)
      .orderBy('c.created_at', 'DESC');

    if (typeof dto.pinId === 'number')
      qb.andWhere('c.pin_id = :pinId', { pinId: dto.pinId });

    if (dto.q && dto.q.trim() !== '') {
      qb.andWhere(
        '(c.customer_name LIKE :kw OR c.distributor_name LIKE :kw OR c.salesperson_name LIKE :kw)',
        { kw: `%${dto.q.trim()}%` },
      );
    }

    if (dto.dateFrom) qb.andWhere('c.created_at >= :df', { df: dto.dateFrom });
    if (dto.dateTo)
      qb.andWhere('c.created_at < DATE_ADD(:dt, INTERVAL 1 DAY)', {
        dt: dto.dateTo,
      });

    if (typeof dto.assigneeId === 'number') {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM contract_assignees a
           WHERE a.contract_id = c.id AND a.account_id = :aid
         )`,
        { aid: dto.assigneeId },
      );
    }

    if (typeof dto.hasFiles === 'boolean') {
      if (dto.hasFiles) qb.andWhere('f.id IS NOT NULL');
      else qb.andWhere('f.id IS NULL');
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(id: number): Promise<Contract> {
    if (!Number.isInteger(id))
      throw new BadRequestException('id는 number여야 합니다.');
    const data = await this.contractRepository.findOne({ where: { id } });
    if (!data) throw new NotFoundException('계약을 찾을 수 없습니다.');
    return data;
  }

  async update(id: number, dto: UpdateContractDto): Promise<number> {
    if (!Number.isInteger(id))
      throw new BadRequestException('id는 number여야 합니다.');
    const found = await this.contractRepository.findOne({ where: { id } });
    if (!found) throw new NotFoundException('계약을 찾을 수 없습니다.');

    await this.contractRepository.update(
      { id },
      {
        pinId: dto.pinId ?? found.pinId,

        customerName: dto.customerName ?? found.customerName,
        customerPhone: dto.customerPhone ?? found.customerPhone,

        distributorName: dto.distributorName ?? found.distributorName,
        distributorPhone: dto.distributorPhone ?? found.distributorPhone,

        salespersonName: dto.salespersonName ?? found.salespersonName,
        salespersonPhone: dto.salespersonPhone ?? found.salespersonPhone,

        brokerageFee: dto.brokerageFee ?? found.brokerageFee,
        vat: dto.vat ?? found.vat,
        brokerageTotal: dto.brokerageTotal ?? found.brokerageTotal,

        rebateTotal: dto.rebateTotal ?? found.rebateTotal,
        supportAmount: dto.supportAmount ?? found.supportAmount,

        isTaxed: typeof dto.isTaxed === 'boolean' ? dto.isTaxed : found.isTaxed,
        calcMemo: dto.calcMemo ?? found.calcMemo,

        grandTotal: dto.grandTotal ?? found.grandTotal,
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
