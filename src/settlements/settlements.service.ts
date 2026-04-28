import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Settlement } from './entities/settlement.entity';
import { Account } from '../dashboard/accounts/entities/account.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { ContractAssignee } from '../contracts/assignees/entities/assignee.entity';
import { Ledger } from '../ledgers/entities/ledgers.entity';


const TAX_FACTOR = 0.967;
const VAT_RATE = 0.1;
const REBATE_UNIT_AMOUNT = 1_000_000;

@Injectable()
export class SettlementsService {
  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    @InjectRepository(ContractAssignee)
    private readonly assigneeRepo: Repository<ContractAssignee>,
    private readonly dataSource: DataSource,
  ) { }

  private sqlGrandTotalExpr(): string {
    const deltaExpr = `
      (
        (CAST(c.rebateUnits AS DECIMAL(18,0)) * ${REBATE_UNIT_AMOUNT})
        - CAST(c.supportAmount AS DECIMAL(18,0))
      )
    `;

    return `
      (
        c.brokerageFee
        + (CASE WHEN c.vatEnabled = 1 THEN ROUND(c.brokerageFee * ${VAT_RATE}) ELSE 0 END)
        + (
            CASE
              WHEN c.isTaxed = 1 THEN ROUND( (${deltaExpr}) * ${TAX_FACTOR} )
              ELSE (${deltaExpr})
            END
          )
        - CAST(c.supportCashAmount AS DECIMAL(18,0))
      )
    `;
  }

  private sqlMyAmountExpr(grandTotalExpr: string): string {
    return `ROUND( (${grandTotalExpr}) * (COALESCE(a.sharePercent, 0) / 100) )`;
  }

  async getMonthlySettlements(year: number, month: number) {
    // 1. 모든 활성 직원 조회
    const employees = await this.accountRepo
      .createQueryBuilder('acc')
      .innerJoin('acc.credential', 'cr')
      .select([
        'acc.id AS id',
        'acc.name AS name',
        'acc.position_rank AS positionRank',
      ])
      .where('acc.is_deleted = false')
      .andWhere('(cr.is_disabled = false OR cr.is_disabled IS NULL)')
      .andWhere('cr.role != :admin', { admin: 'admin' })
      .getRawMany();

    // 2. 이미 저장된 정산 기록 조회
    const savedSettlements = await this.settlementRepo.find({
      where: { year, month },
    });

    const grandTotalExpr = this.sqlGrandTotalExpr();
    const myAmountExpr = this.sqlMyAmountExpr(grandTotalExpr);

    // 3. 실적 계산 (실시간)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const performanceRows = await this.contractRepo
      .createQueryBuilder('c')
      .innerJoin(ContractAssignee, 'a', 'a.contract_id = c.id')
      .select('a.account_id', 'accountId')
      .addSelect(`COALESCE(SUM(${myAmountExpr}), 0)`, 'calculatedAmount')
      .where('c.status = :done', { done: 'done' })
      .andWhere('c.final_payment_date >= :s AND c.final_payment_date <= :e', {
        s: startDate,
        e: endDate,
      })
      .groupBy('a.account_id')
      .getRawMany<{ accountId: string; calculatedAmount: string }>();

    const performanceMap = new Map(
      performanceRows.map((r) => [r.accountId, Number(r.calculatedAmount)]),
    );

    // 4. 결과 조립
    return employees.map((emp) => {
      const saved = savedSettlements.find((s) => s.accountId === emp.id);
      const calculated = performanceMap.get(emp.id) ?? 0;

      return {
        accountId: emp.id,
        name: emp.name,
        positionRank: emp.position_rank,
        calculatedAmount: saved ? saved.calculatedAmount : calculated,
        adjustmentAmount: saved ? saved.adjustmentAmount : 0,
        finalAmount: saved ? saved.finalAmount : calculated,
        status: saved ? saved.status : 'pending',
        paidAt: saved ? saved.paidAt : null,
        memo: saved ? saved.memo : null,
        isSaved: !!saved,
      };
    });
  }



  async saveSettlement(
    data: {
      accountId: string;
      year: number;
      month: number;
      adjustmentAmount: number;
      memo?: string;
      status?: 'pending' | 'paid';
    },
    credentialId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(Settlement);

      let settlement = await settlementRepo.findOne({
        where: {
          accountId: data.accountId,
          year: data.year,
          month: data.month,
        },
      });

      // 실시간 계산 금액 다시 가져오기 (무결성 위해)
      const startDate = `${data.year}-${String(data.month).padStart(2, '0')}-01`;
      const lastDay = new Date(data.year, data.month, 0).getDate();
      const endDate = `${data.year}-${String(data.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const grandTotalExpr = this.sqlGrandTotalExpr();
      const myAmountExpr = this.sqlMyAmountExpr(grandTotalExpr);

      const perf = await manager
        .getRepository(Contract)
        .createQueryBuilder('c')
        .innerJoin(ContractAssignee, 'a', 'a.contract_id = c.id')
        .select(`COALESCE(SUM(${myAmountExpr}), 0)`, 'amount')
        .where('c.status = :done', { done: 'done' })
        .andWhere('a.account_id = :aid', { aid: data.accountId })
        .andWhere('c.final_payment_date >= :s AND c.final_payment_date <= :e', {
          s: startDate,
          e: endDate,
        })
        .getRawOne<{ amount: string }>();

      const calculatedAmount = Number(perf?.amount ?? 0);

      if (!settlement) {
        settlement = settlementRepo.create({
          accountId: data.accountId,
          year: data.year,
          month: data.month,
        });
      }

      settlement.calculatedAmount = calculatedAmount;
      settlement.adjustmentAmount = data.adjustmentAmount;
      settlement.finalAmount = calculatedAmount + data.adjustmentAmount;
      settlement.memo = data.memo ?? settlement.memo;

      if (data.status) {
        settlement.status = data.status;
        if (data.status === 'paid' && !settlement.paidAt) {
          settlement.paidAt = new Date();
        } else if (data.status === 'pending') {
          settlement.paidAt = null;
        }
      }


      return settlementRepo.save(settlement);
    });
  }

  async updateStatus(id: number, status: 'pending' | 'paid', credentialId: string) {
    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(Settlement);
      const settlement = await settlementRepo.findOne({ where: { id } });
      if (!settlement) throw new NotFoundException('정산 기록을 찾을 수 없습니다.');

      settlement.status = status;
      if (status === 'paid') {
        settlement.paidAt = new Date();
      } else {
        settlement.paidAt = null;
      }


      return settlementRepo.save(settlement);
    });
  }

  async getSettlementDetail(accountId: string, year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const grandTotalExpr = this.sqlGrandTotalExpr();
    const myAmountExpr = this.sqlMyAmountExpr(grandTotalExpr);

    const detailRows = await this.contractRepo
      .createQueryBuilder('c')
      .innerJoin(ContractAssignee, 'a', 'a.contract_id = c.id')
      .select([
        'c.id as contractId',
        'c.siteName as propertyName',
        'c.final_payment_date as finalPaymentDate',
        'c.brokerageFee as brokerageFee',
        'c.rebateUnits as rebateUnits',
        'c.supportAmount as supportAmount',
        'c.supportCashAmount as supportCashAmount',
        'c.vatEnabled as vatEnabled',
        'c.isTaxed as isTaxed',
        'a.sharePercent as sharePercent',
      ])
      .addSelect(myAmountExpr, 'myAmount')
      .addSelect(grandTotalExpr, 'grandTotal')
      .where('c.status = :done', { done: 'done' })
      .andWhere('a.account_id = :aid', { aid: accountId })
      .andWhere('c.final_payment_date >= :s AND c.final_payment_date <= :e', {
        s: startDate,
        e: endDate,
      })
      .orderBy('c.final_payment_date', 'ASC')
      .getRawMany();

    return detailRows.map(row => ({
      ...row,
      finalPaymentDate: row.finalPaymentDate instanceof Date 
        ? row.finalPaymentDate.toISOString().split('T')[0] 
        : String(row.finalPaymentDate).split('T')[0],
      myAmount: Number(row.myAmount),
      grandTotal: Number(row.grandTotal),
      sharePercent: Number(row.sharePercent),
    }));
  }

  async getYearlySettlements(year: number) {
    const rows = await this.settlementRepo
      .createQueryBuilder('s')
      .select('s.month', 'month')
      .addSelect('SUM(s.finalAmount)', 'totalAmount')
      .addSelect("SUM(CASE WHEN s.status = 'paid' THEN s.finalAmount ELSE 0 END)", 'paidAmount')
      .where('s.year = :year', { year })
      .groupBy('s.month')
      .orderBy('s.month', 'ASC')
      .getRawMany();

    return rows.map(r => ({
      month: Number(r.month),
      totalAmount: Number(r.totalAmount),
      paidAmount: Number(r.paidAmount),
    }));
  }

  async cleanupOldLedgerEntries() {
    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(Settlement);
      const ledgerRepo = manager.getRepository(Ledger);

      // ledgerId가 있는 모든 정산 기록 조회
      const settlementsWithLedger = await settlementRepo.find({
        where: { ledgerId: this.dataSource.driver.constructor.name === 'MysqlDriver' ? (require('typeorm').Not(require('typeorm').IsNull())) : undefined },
      });
      // 위 방식은 복잡할 수 있으니 QueryBuilder 사용
      const records = await settlementRepo
        .createQueryBuilder('s')
        .where('s.ledger_id IS NOT NULL')
        .getMany();

      if (records.length === 0) return { deletedCount: 0, updatedCount: 0 };

      const ledgerIds = records.map(r => r.ledgerId).filter(id => id !== null);
      
      // 가계부 내역 삭제
      let deletedCount = 0;
      if (ledgerIds.length > 0) {
        const result = await ledgerRepo.delete(ledgerIds);
        deletedCount = result.affected ?? 0;
      }

      // 정산 기록에서 ledgerId 제거
      for (const record of records) {
        record.ledgerId = null;
      }
      await settlementRepo.save(records);

      return { deletedCount, updatedCount: records.length };
    });
  }
}
