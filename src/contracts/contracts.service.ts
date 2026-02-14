import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { Contract } from './entities/contract.entity';

import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ListContractsDto } from './dto/list-contracts.dto';

import { calcContractMoney } from './contracts.calc';
import { Account } from '../dashboard/accounts/entities/account.entity';
import { ContractAssignee } from './assignees/entities/assignee.entity';
import { ContractFile } from './files/entities/file.entity';

import { maskIfDisabled } from '../common/mappers/account-visibility';

type Role = 'admin' | 'manager' | 'staff';

type ListItem = {
  id: number;
  contractNo: string;

  createdByAccountId: string | null;
  createdByName: string | null;

  customerName: string;
  customerPhone: string;

  contractDate: string;
  finalPaymentDate: string;
  status: string;

  siteName: string;
  siteAddress: string;

  // 원본
  brokerageFee: number;
  vatEnabled: boolean;
  rebateUnits: number;
  supportAmount: number;
  isTaxed: boolean;
  companyPercent: number;

  // derived
  vatAmount: number;
  rebateAmount: number;
  grandTotal: number;

  // admin list에서는 회사 매출도 보이니 포함
  companyAmount: number;

  // me list에서만 내려줌
  mySharePercent?: number;
  myAmount?: number;
  bank?: string | null;
  account?: string | null;
};

type AccountWithCredential = Account & {
  credential?: { is_disabled?: boolean };
};

@Injectable()
export class ContractsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    @InjectRepository(ContractAssignee)
    private readonly assigneeRepo: Repository<ContractAssignee>,
    @InjectRepository(ContractFile)
    private readonly fileRepo: Repository<ContractFile>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  private async resolveAccountByCredentialIdOrThrow(
    credentialId: string,
  ): Promise<Account> {
    if (!credentialId)
      throw new BadRequestException('세션 credentialId가 없습니다.');

    const account = await this.accountRepo
      .createQueryBuilder('a')
      .innerJoin('a.credential', 'cred')
      .where('a.credential_id = :cid', { cid: String(credentialId) })
      .andWhere('a.is_deleted = false')
      .andWhere('cred.is_disabled = false')
      .select(['a.id', 'a.name', 'a.credential_id', 'a.is_deleted'])
      .getOne();

    if (!account) throw new ForbiddenException('유효하지 않은 세션입니다.');
    return account;
  }

  private buildContractNo(yyyymmdd: string, id: number): string {
    // KN 고정 + CNT 고정 + 날짜 + PK(8자리)
    const suffix = String(id).padStart(8, '0');
    return `KNCNT${yyyymmdd}${suffix}`;
  }

  private normalizePaging(dto: ListContractsDto) {
    const page =
      Number.isInteger(dto.page) && (dto.page as number) > 0
        ? (dto.page as number)
        : 1;
    const sizeRaw =
      Number.isInteger(dto.size) && (dto.size as number) > 0
        ? (dto.size as number)
        : 20;
    const size = Math.min(Math.max(sizeRaw, 1), 100);

    const orderBy =
      dto.orderBy === 'created_at' ? 'c.createdAt' : 'c.contractDate';
    const orderDir: 'ASC' | 'DESC' = dto.orderDir === 'ASC' ? 'ASC' : 'DESC';

    return { page, size, orderBy, orderDir };
  }

  private assertAssigneesRule(
    companyPercent: number,
    assignees?: Array<{ sharePercent: number }>,
  ) {
    // 1) companyPercent 범위
    if (
      !Number.isFinite(companyPercent) ||
      companyPercent < 0 ||
      companyPercent > 100
    ) {
      throw new BadRequestException('companyPercent는 0~100 사이여야 합니다.');
    }

    // assignees가 없으면 OK (회사 비율만으로도 계약 생성 가능)
    if (!assignees || assignees.length === 0) return;

    // 2) companyPercent가 100이면 직원 배정 불가
    if (companyPercent >= 100) {
      throw new BadRequestException(
        'companyPercent가 100이면 assignees를 둘 수 없습니다.',
      );
    }

    // 3) 직원 퍼센트 합계는 (100 - companyPercent) 이어야 함
    const expected = 100 - companyPercent;

    const sum = assignees.reduce((s, a) => {
      const v = Number.isFinite(a.sharePercent) ? a.sharePercent : 0;
      return s + v;
    }, 0);

    // 소수점 오차 허용
    if (Math.abs(sum - expected) > 0.0001) {
      throw new BadRequestException(
        `assignees sharePercent 합계는 ${expected}이어야 합니다. (companyPercent=${companyPercent})`,
      );
    }
  }

  private canAccessContractAsStaff(
    myAccountId: string,
    contract: Contract,
    assigneeExists: boolean,
  ) {
    const isCreator =
      String(contract.createdByAccountId ?? '') === String(myAccountId);
    return isCreator || assigneeExists;
  }

  private canUpdateContractAsStaff(myAccountId: string, contract: Contract) {
    // staff는 "본인 생성 계약"만 수정 가능
    return String(contract.createdByAccountId ?? '') === String(myAccountId);
  }

  async create(
    credentialId: string,
    dto: CreateContractDto,
  ): Promise<{ id: number; contractNo: string }> {
    const me = await this.resolveAccountByCredentialIdOrThrow(credentialId);

    this.assertAssigneesRule(dto.companyPercent, dto.assignees);

    const savedId = await this.dataSource.transaction(async (m) => {
      const cRepo = m.getRepository(Contract);
      const aRepo = m.getRepository(ContractAssignee);
      const fRepo = m.getRepository(ContractFile);

      // 1) 계약 먼저 저장 (contractNo TEMP)
      const created = cRepo.create({
        contractNo: 'TEMP',
        createdBy: { id: String(me.id) } as Account,

        customerName: dto.customerName,
        customerPhone: dto.customerPhone,

        brokerageFee: dto.brokerageFee,
        vatEnabled: dto.vat,
        rebateUnits: dto.rebate,
        supportAmount: dto.supportAmount,
        isTaxed: dto.isTaxed,
        calcMemo: dto.calcMemo ?? null,

        companyPercent: dto.companyPercent,

        contractDate: dto.contractDate,
        finalPaymentDate: dto.finalPaymentDate,
        status: dto.status ?? 'ongoing',

        siteAddress: dto.siteAddress,
        siteName: dto.siteName,
        salesTeamPhone: dto.salesTeamPhone,
        bank: dto.bank ?? null,
        account: dto.account ?? null,
      });

      const saved = await cRepo.save(created);

      // 2) contractNo 업데이트
      const yyyymmdd = dto.contractDate.replaceAll('-', '');
      const contractNo = this.buildContractNo(yyyymmdd, Number(saved.id));
      await cRepo.update({ id: saved.id }, { contractNo });

      // 3) assignees 저장(원본만)
      if (dto.assignees?.length) {
        const rows = dto.assignees.map((a, idx) =>
          aRepo.create({
            contract: { id: saved.id } as any,
            account: { id: String(a.accountId) } as any,
            sharePercent: a.sharePercent,
            sortOrder: a.sortOrder ?? idx,
          }),
        );
        await aRepo.save(rows);
      }

      // 4) urls 저장
      if (dto.urls?.length) {
        const rows = dto.urls.map((url, idx) =>
          fRepo.create({
            contract: { id: saved.id } as any,
            url,
            sortOrder: idx,
          }),
        );
        await fRepo.save(rows);
      }

      return Number(saved.id);
    });

    const contract = await this.contractRepo.findOne({
      where: { id: savedId },
      select: ['id', 'contractNo'],
    });

    return { id: savedId, contractNo: contract?.contractNo ?? '' };
  }

  async listAll(
    role: Role,
    dto: ListContractsDto,
  ): Promise<{ items: ListItem[]; total: number }> {
    const { page, size, orderBy, orderDir } = this.normalizePaging(dto);

    const qb = this.contractRepo
      .createQueryBuilder('c')
      .leftJoin('c.createdBy', 'cb')
      .leftJoin('cb.credential', 'cbCred')
      .addSelect(['cb.id', 'cb.name', 'cbCred.is_disabled']);

    if (dto.q?.trim()) {
      const kw = `%${dto.q.trim()}%`;
      qb.andWhere(
        `(c.contractNo LIKE :kw
          OR c.customerName LIKE :kw
          OR c.customerPhone LIKE :kw
          OR c.siteName LIKE :kw
          OR c.siteAddress LIKE :kw)`,
        { kw },
      );
    }

    if (dto.status) qb.andWhere('c.status = :st', { st: dto.status });
    if (dto.dateFrom)
      qb.andWhere('c.contractDate >= :df', { df: dto.dateFrom });
    if (dto.dateTo) qb.andWhere('c.contractDate <= :dt', { dt: dto.dateTo });

    const dataQb = qb
      .clone()
      .orderBy(orderBy, orderDir)
      .skip((page - 1) * size)
      .take(size);
    const countQb = qb.clone().orderBy().skip(0).take(0);

    const [items, total] = await Promise.all([
      dataQb.getMany(),
      countQb.getCount(),
    ]);

    const mapped: ListItem[] = items.map((c) => {
      const createdBy = (c.createdBy as AccountWithCredential | null) ?? null;

      const createdByMasked = maskIfDisabled({
        isDisabled: Boolean(createdBy?.credential?.is_disabled),
        name: createdBy?.name ?? null,
      });

      const calc = calcContractMoney({
        brokerageFee: c.brokerageFee,
        vatEnabled: c.vatEnabled,
        rebateUnits: c.rebateUnits,
        supportAmount: c.supportAmount,
        isTaxed: c.isTaxed,
        companyPercent: Number(c.companyPercent),
      });

      return {
        id: Number(c.id),
        contractNo: c.contractNo,

        createdByAccountId: c.createdByAccountId,
        createdByName: createdByMasked.name,

        customerName: c.customerName,
        customerPhone: c.customerPhone,

        contractDate: c.contractDate,
        finalPaymentDate: c.finalPaymentDate,
        status: c.status,

        siteName: c.siteName,
        siteAddress: c.siteAddress,

        bank: c.bank ?? null,
        account: c.account ?? null,

        brokerageFee: c.brokerageFee,
        vatEnabled: c.vatEnabled,
        rebateUnits: c.rebateUnits,
        supportAmount: c.supportAmount,
        isTaxed: c.isTaxed,
        companyPercent: Number(c.companyPercent),

        vatAmount: calc.vatAmount,
        rebateAmount: calc.rebateAmount,
        grandTotal: calc.grandTotal,
        companyAmount: calc.companyAmount,
      };
    });

    return { items: mapped, total };
  }

  async listMe(
    credentialId: string,
    dto: ListContractsDto,
  ): Promise<{ items: ListItem[]; total: number }> {
    const me = await this.resolveAccountByCredentialIdOrThrow(credentialId);
    const { page, size, orderBy, orderDir } = this.normalizePaging(dto);

    const qb = this.contractRepo
      .createQueryBuilder('c')
      .leftJoin('c.createdBy', 'cb')
      .leftJoin('cb.credential', 'cbCred')
      .addSelect(['cb.id', 'cb.name', 'cbCred.is_disabled'])
      .leftJoin('contract_assignees', 'a', 'a.contract_id = c.id')
      .where('(c.created_by_account_id = :me OR a.account_id = :me)', {
        me: String(me.id),
      })
      .distinct(true);

    if (dto.q?.trim()) {
      const kw = `%${dto.q.trim()}%`;
      qb.andWhere(
        `(c.contractNo LIKE :kw
          OR c.customerName LIKE :kw
          OR c.customerPhone LIKE :kw
          OR c.siteName LIKE :kw
          OR c.siteAddress LIKE :kw)`,
        { kw },
      );
    }

    if (dto.status) qb.andWhere('c.status = :st', { st: dto.status });
    if (dto.dateFrom)
      qb.andWhere('c.contractDate >= :df', { df: dto.dateFrom });
    if (dto.dateTo) qb.andWhere('c.contractDate <= :dt', { dt: dto.dateTo });

    const dataQb = qb
      .clone()
      .orderBy(orderBy, orderDir)
      .skip((page - 1) * size)
      .take(size);
    const countQb = qb.clone().orderBy().skip(0).take(0);

    const [contracts, total] = await Promise.all([
      dataQb.getMany(),
      countQb.getCount(),
    ]);

    const ids = contracts.map((c) => Number(c.id));

    // 내 sharePercent 맵(한 방)
    const myRows =
      ids.length === 0
        ? []
        : await this.assigneeRepo
            .createQueryBuilder('a')
            .select('a.contract_id', 'contractId')
            .addSelect('a.sharePercent', 'sharePercent')
            .where('a.contract_id IN (:...ids)', { ids })
            .andWhere('a.account_id = :me', { me: String(me.id) })
            .getRawMany<{ contractId: string; sharePercent: string }>();

    const myShareMap = new Map<number, number>(
      myRows.map((r) => [Number(r.contractId), Number(r.sharePercent)]),
    );

    const mapped: ListItem[] = contracts.map((c) => {
      const createdBy = (c.createdBy as AccountWithCredential | null) ?? null;

      const createdByMasked = maskIfDisabled({
        isDisabled: Boolean(createdBy?.credential?.is_disabled),
        name: createdBy?.name ?? null,
      });

      const calc = calcContractMoney({
        brokerageFee: c.brokerageFee,
        vatEnabled: c.vatEnabled,
        rebateUnits: c.rebateUnits,
        supportAmount: c.supportAmount,
        isTaxed: c.isTaxed,
        companyPercent: Number(c.companyPercent),
      });

      const mySharePercent = myShareMap.get(Number(c.id)) ?? 0;
      const myAmount = Math.round(
        calc.staffPoolAmount * (mySharePercent / 100),
      );

      return {
        id: Number(c.id),
        contractNo: c.contractNo,

        createdByAccountId: c.createdByAccountId,
        createdByName: createdByMasked.name,

        customerName: c.customerName,
        customerPhone: c.customerPhone,

        contractDate: c.contractDate,
        finalPaymentDate: c.finalPaymentDate,
        status: c.status,

        siteName: c.siteName,
        siteAddress: c.siteAddress,

        bank: c.bank ?? null,
        account: c.account ?? null,

        brokerageFee: c.brokerageFee,
        vatEnabled: c.vatEnabled,
        rebateUnits: c.rebateUnits,
        supportAmount: c.supportAmount,
        isTaxed: c.isTaxed,
        companyPercent: Number(c.companyPercent),

        vatAmount: calc.vatAmount,
        rebateAmount: calc.rebateAmount,
        grandTotal: calc.grandTotal,
        companyAmount: calc.companyAmount,

        mySharePercent,
        myAmount,
      };
    });

    return { items: mapped, total };
  }

  async getDetailById(credentialId: string, role: Role, id: number) {
    const me = await this.resolveAccountByCredentialIdOrThrow(credentialId);

    const contract = await this.contractRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.createdBy', 'cb')
      .leftJoin('cb.credential', 'cbCred')
      .addSelect(['cbCred.is_disabled'])
      .where('c.id = :id', { id: Number(id) })
      .getOne();

    if (!contract) throw new NotFoundException('계약을 찾을 수 없습니다.');

    if (role === 'staff') {
      // createdByAccountId/RelationId에 의존하지 않고 DB 컬럼 기준으로 접근 가능 여부를 확정
      const ok = await this.contractRepo
        .createQueryBuilder('c')
        .leftJoin('contract_assignees', 'a', 'a.contract_id = c.id')
        .where('c.id = :id', { id: Number(id) })
        .andWhere('(c.created_by_account_id = :me OR a.account_id = :me)', {
          me: String(me.id),
        })
        .getExists();

      if (!ok) throw new ForbiddenException('접근 권한이 없습니다.');
    }

    const [assignees, files] = await Promise.all([
      this.assigneeRepo
        .createQueryBuilder('a')
        .leftJoinAndSelect('a.account', 'acc')
        .leftJoin('acc.credential', 'accCred')
        .addSelect(['accCred.is_disabled'])
        .where('a.contract_id = :id', { id: Number(id) })
        .orderBy('a.sortOrder', 'ASC')
        .addOrderBy('a.id', 'ASC')
        .getMany(),
      this.fileRepo.find({
        where: { contract: { id: Number(id) } as any },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
    ]);

    const calc = calcContractMoney({
      brokerageFee: contract.brokerageFee,
      vatEnabled: contract.vatEnabled,
      rebateUnits: contract.rebateUnits,
      supportAmount: contract.supportAmount,
      isTaxed: contract.isTaxed,
      companyPercent: Number(contract.companyPercent),
    });

    const my = assignees.find(
      (a) => String(a.accountId ?? '') === String(me.id),
    );
    const mySharePercent = my ? Number(my.sharePercent) : 0;
    const myAmount = Math.round(calc.staffPoolAmount * (mySharePercent / 100));

    const createdBy =
      (contract.createdBy as AccountWithCredential | null) ?? null;
    const createdByMasked = maskIfDisabled({
      isDisabled: Boolean(createdBy?.credential?.is_disabled),
      name: createdBy?.name ?? null,
    });

    return {
      id: Number(contract.id),
      contractNo: contract.contractNo,

      createdBy: {
        accountId: contract.createdByAccountId,
        name: createdByMasked.name,
        isDisabled: createdByMasked.isDisabled,
      },

      customerName: contract.customerName,
      customerPhone: contract.customerPhone,

      brokerageFee: contract.brokerageFee,
      vat: contract.vatEnabled,
      rebate: contract.rebateUnits,
      supportAmount: contract.supportAmount,
      isTaxed: contract.isTaxed,
      calcMemo: contract.calcMemo,

      companyPercent: Number(contract.companyPercent),

      contractDate: contract.contractDate,
      finalPaymentDate: contract.finalPaymentDate,
      status: contract.status,

      siteAddress: contract.siteAddress,
      siteName: contract.siteName,
      salesTeamPhone: contract.salesTeamPhone,

      bank: contract.bank ?? null,
      account: contract.account ?? null,

      urls: files.map((f) => f.url),

      assignees: assignees.map((a) => {
        const acc = (a.account as AccountWithCredential | null) ?? null;
        const masked = maskIfDisabled({
          isDisabled: Boolean(acc?.credential?.is_disabled),
          name: acc?.name ?? null,
        });

        return {
          accountId: a.accountId,
          name: masked.name,
          isDisabled: masked.isDisabled,
          sharePercent: Number(a.sharePercent),
          sortOrder: Number(a.sortOrder),
        };
      }),

      derived: {
        vatAmount: calc.vatAmount,
        rebateAmount: calc.rebateAmount,
        grandTotal: calc.grandTotal,
        companyAmount: calc.companyAmount,
        staffPoolAmount: calc.staffPoolAmount,
        mySharePercent,
        myAmount,
      },

      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  async getDetailByContractNo(
    credentialId: string,
    role: Role,
    contractNo: string,
  ) {
    const contract = await this.contractRepo.findOne({
      where: { contractNo },
      select: ['id'],
    });
    if (!contract) throw new NotFoundException('계약을 찾을 수 없습니다.');
    return this.getDetailById(credentialId, role, Number(contract.id));
  }

  async update(
    credentialId: string,
    role: Role,
    id: number,
    dto: UpdateContractDto,
  ): Promise<{ id: number }> {
    const me = await this.resolveAccountByCredentialIdOrThrow(credentialId);

    await this.dataSource.transaction(async (m) => {
      const cRepo = m.getRepository(Contract);
      const aRepo = m.getRepository(ContractAssignee);
      const fRepo = m.getRepository(ContractFile);

      const contract = await cRepo
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.createdBy', 'createdBy')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: Number(id) })
        .getOne();

      if (!contract) throw new NotFoundException('계약을 찾을 수 없습니다.');

      if (role === 'staff') {
        if (!this.canUpdateContractAsStaff(String(me.id), contract)) {
          throw new ForbiddenException('수정 권한이 없습니다.');
        }
      }

      const nextCompanyPercent = Number(
        dto.companyPercent ?? Number(contract.companyPercent),
      );

      if (dto.assignees !== undefined) {
        this.assertAssigneesRule(nextCompanyPercent, dto.assignees);
      } else {
        if (dto.companyPercent !== undefined) {
          const existingCount = await aRepo.count({
            where: { contract: { id: Number(id) } as any },
          });

          if (existingCount > 0 && nextCompanyPercent >= 100) {
            throw new BadRequestException(
              'assignees가 존재하는 계약은 companyPercent를 100으로 설정할 수 없습니다.',
            );
          }
        }
      }

      contract.customerName = dto.customerName ?? contract.customerName;
      contract.customerPhone = dto.customerPhone ?? contract.customerPhone;

      contract.brokerageFee = dto.brokerageFee ?? contract.brokerageFee;
      contract.vatEnabled = dto.vat ?? contract.vatEnabled;
      contract.rebateUnits = dto.rebate ?? contract.rebateUnits;
      contract.supportAmount = dto.supportAmount ?? contract.supportAmount;
      contract.isTaxed = dto.isTaxed ?? contract.isTaxed;
      contract.calcMemo = dto.calcMemo ?? contract.calcMemo;

      contract.companyPercent = nextCompanyPercent;

      contract.contractDate = dto.contractDate ?? contract.contractDate;
      contract.finalPaymentDate =
        dto.finalPaymentDate ?? contract.finalPaymentDate;
      contract.status = (dto.status ?? contract.status) as any;

      contract.siteAddress = dto.siteAddress ?? contract.siteAddress;
      contract.siteName = dto.siteName ?? contract.siteName;
      contract.salesTeamPhone = dto.salesTeamPhone ?? contract.salesTeamPhone;

      contract.bank = dto.bank ?? contract.bank ?? null;
      contract.account = dto.account ?? contract.account ?? null;

      await cRepo.save(contract);

      if (dto.assignees !== undefined) {
        await aRepo.delete({ contract: { id: Number(id) } as any });

        if (dto.assignees.length > 0) {
          const rows = dto.assignees.map((a, idx) =>
            aRepo.create({
              contract: { id: Number(id) } as any,
              account: { id: String(a.accountId) } as any,
              sharePercent: a.sharePercent,
              sortOrder: a.sortOrder ?? idx,
            }),
          );
          await aRepo.save(rows);
        }
      }

      if (dto.urls !== undefined) {
        await fRepo.delete({ contract: { id: Number(id) } as any });

        if (dto.urls.length > 0) {
          const rows = dto.urls.map((url, idx) =>
            fRepo.create({
              contract: { id: Number(id) } as any,
              url,
              sortOrder: idx,
            }),
          );
          await fRepo.save(rows);
        }
      }
    });

    return { id: Number(id) };
  }

  async remove(role: Role, id: number): Promise<void> {
    if (role === 'staff') throw new ForbiddenException('삭제 권한이 없습니다.');
    const found = await this.contractRepo.findOne({
      where: { id: Number(id) },
      select: ['id'],
    });
    if (!found) throw new NotFoundException('계약을 찾을 수 없습니다.');
    await this.contractRepo.delete({ id: Number(id) } as any);
  }
}
