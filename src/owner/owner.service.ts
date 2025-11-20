import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
  SelectQueryBuilder,
  ObjectLiteral,
} from 'typeorm';
import { Contract } from '../contracts/entities/contract.entity';
import {
  ContractListFilter,
  ContractListItem,
  ContractListResult,
  DashboardSummary,
  FinanceFilter,
  FinanceResult,
  FinanceSummary,
  PerformanceFilter,
  PerformanceResult,
  PeriodFilter,
  SortKey,
  // 실적/통계용 타입들
  StaffContractPerformanceRow,
  StaffScheduledSurveyRow,
  StaffSurveyPerformanceRow,
  TeamContractPerformanceRow,
  PinCityFilter,
  PinCityStat,
  PinDistrictStat,
  PinStatsFilter,
  PinStatsResult,
  PinStatsSummary,
} from './types/adminType';
import { SurveyReservation } from '../survey-reservations/entities/survey-reservation.entity';
import { Pin } from '../maps/pins/entities/pin.entity';
import { PinDraft } from '../survey-reservations/entities/pin-draft.entity';

@Injectable()
export class OwnerService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    private readonly dataSource: DataSource,
  ) {}

  // =========================
  // 1. 대시보드 요약
  // =========================
  async getDashboardSummary(): Promise<DashboardSummary> {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);

    const monthAgo = new Date();
    monthAgo.setMonth(today.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().slice(0, 10);

    const ongoingCount = await this.contractRepo.count({
      where: { status: 'ongoing' },
    });

    const todayDone = await this.contractRepo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: 'done' })
      .andWhere('c.contractDate = :today', { today: todayStr })
      .getCount();

    const weekDone = await this.contractRepo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: 'done' })
      .andWhere('c.contractDate BETWEEN :from AND :to', {
        from: weekAgoStr,
        to: todayStr,
      })
      .getCount();

    const monthDone = await this.contractRepo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: 'done' })
      .andWhere('c.contractDate BETWEEN :from AND :to', {
        from: monthAgoStr,
        to: todayStr,
      })
      .getCount();

    return {
      ongoingCount,
      todayDone,
      weekDone,
      monthDone,
    };
  }

  // =========================
  // 2. 계약 리스트 (기존)
  // =========================
  async getContractsList(
    filter: ContractListFilter,
  ): Promise<ContractListResult> {
    const qb = this.contractRepo
      .createQueryBuilder('c')
      .leftJoin('c.salesperson', 'acc') // Account
      .leftJoin(
        'team_members',
        'tm',
        'tm.account_id = acc.id AND tm.is_primary = 1',
      )
      .leftJoin('teams', 't', 't.id = tm.team_id');

    // 상태 필터
    if (filter.status !== 'all') {
      qb.andWhere('c.status = :status', { status: filter.status });
    }

    // 계약번호 범위
    if (typeof filter.idFrom === 'number') {
      qb.andWhere('c.id >= :idFrom', { idFrom: filter.idFrom });
    }
    if (typeof filter.idTo === 'number') {
      qb.andWhere('c.id <= :idTo', { idTo: filter.idTo });
    }

    // 기간 필터
    if (filter.period !== 'custom') {
      const { from, to } = this.buildPeriodRange(filter.period);
      if (from && to) {
        qb.andWhere('c.contractDate BETWEEN :from AND :to', { from, to });
      }
    } else if (filter.from && filter.to) {
      qb.andWhere('c.contractDate BETWEEN :from AND :to', {
        from: filter.from,
        to: filter.to,
      });
    }

    // 금액 범위 (최종합계 기준)
    if (typeof filter.grandMin === 'number') {
      qb.andWhere('c.grandTotal >= :grandMin', { grandMin: filter.grandMin });
    }
    if (typeof filter.grandMax === 'number') {
      qb.andWhere('c.grandTotal <= :grandMax', { grandMax: filter.grandMax });
    }

    // 텍스트 필터
    if (filter.qCustomer) {
      qb.andWhere('c.customerName LIKE :qCustomer', {
        qCustomer: `%${filter.qCustomer}%`,
      });
    }

    if (filter.qSalesperson) {
      qb.andWhere('acc.name LIKE :qSalesperson', {
        qSalesperson: `%${filter.qSalesperson}%`,
      });
    }

    if (filter.qTeam) {
      qb.andWhere('t.name LIKE :qTeam', {
        qTeam: `%${filter.qTeam}%`,
      });
    }

    // 정렬
    const sortMap: Record<SortKey, string> = {
      contractDate: 'c.contractDate',
      grandTotal: 'c.grandTotal',
      createdAt: 'c.createdAt',
    };

    const sortColumn = sortMap[filter.sort] ?? 'c.contractDate';
    qb.orderBy(sortColumn, filter.dir.toUpperCase() as 'ASC' | 'DESC');

    // 페이징
    const page = filter.page;
    const pageSize = filter.pageSize;
    const offset = (page - 1) * pageSize;

    // (getRawMany() 전에 select 정의)
    qb.select([
      'c.id AS id',
      'c.status AS status',
      'c.contractDate AS contractDate',
      'c.customerName AS customerName',
      'c.customerPhone AS customerPhone',
      'c.brokerageTotal AS brokerageTotal',
      'c.rebateTotal AS rebateTotal',
      'c.supportAmount AS supportAmount',
      'c.grandTotal AS grandTotal',
      'acc.name AS "salespersonName"',
      't.name AS "teamName"',
    ])
      .offset(offset)
      .limit(pageSize);

    const rows = await qb.getRawMany<{
      id: string;
      status: 'ongoing' | 'done' | 'canceled';
      contractDate: Date | string;
      customerName: string | null;
      customerPhone: string | null;
      brokerageTotal: string | null;
      rebateTotal: string | null;
      supportAmount: string | null;
      grandTotal: string | null;
      salespersonName: string | null;
      teamName: string | null;
    }>();

    const totalCount = await qb.getCount();

    const items: ContractListItem[] = rows.map((row) => {
      const rawDate = row.contractDate;
      const dateStr =
        rawDate instanceof Date
          ? rawDate.toISOString().slice(0, 10)
          : String(rawDate).slice(0, 10); // 2025-10-28T... → 2025-10-28

      const statusLabel =
        row.status === 'ongoing'
          ? '진행중'
          : row.status === 'done'
            ? '완료'
            : '취소';

      return {
        id: Number(row.id),
        status: row.status,
        statusLabel,
        contractDate: dateStr,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        salespersonName: row.salespersonName,
        teamName: row.teamName,
        brokerageTotal: Number(row.brokerageTotal ?? 0),
        rebateTotal: Number(row.rebateTotal ?? 0),
        supportAmount: Number(row.supportAmount ?? 0),
        grandTotal: Number(row.grandTotal ?? 0),
      };
    });

    return {
      items,
      totalCount,
      page,
      pageSize,
    };
  }

  // =========================
  // 3. 매출/정산 필터 빌더
  // =========================
  buildFinanceFilter(query: any): FinanceFilter {
    const periodValues: PeriodFilter[] = [
      'today',
      'week',
      'month',
      'quarter',
      'half',
      'year',
      'custom',
    ];

    const period =
      (periodValues.find((v) => v === query.period) as
        | PeriodFilter
        | undefined) ?? 'month';

    const from = typeof query.from === 'string' ? query.from : undefined;
    const to = typeof query.to === 'string' ? query.to : undefined;

    return {
      period,
      from,
      to,
      qTeam: query.qTeam || undefined,
      qSalesperson: query.qSalesperson || undefined,
    };
  }

  // =========================
  // 4. 매출/정산 요약 + 사원/팀 분배
  // =========================
  async getFinanceSummary(filter: FinanceFilter): Promise<FinanceResult> {
    // base query: 완료된 계약 + 담당자 분배
    const qb = this.contractRepo
      .createQueryBuilder('c')
      .innerJoin('contract_assignees', 'ca', 'ca.contract_id = c.id')
      .leftJoin('accounts', 'acc', 'acc.id = ca.account_id')
      .leftJoin(
        'team_members',
        'tm',
        'tm.account_id = acc.id AND tm.is_primary = 1',
      )
      .leftJoin('teams', 't', 't.id = tm.team_id')
      .where('c.status = :status', { status: 'done' });

    // 기간 필터
    if (filter.period !== 'custom') {
      const { from, to } = this.buildPeriodRange(filter.period);
      if (from && to) {
        qb.andWhere('c.contractDate BETWEEN :from AND :to', { from, to });
      }
    } else if (filter.from && filter.to) {
      qb.andWhere('c.contractDate BETWEEN :from AND :to', {
        from: filter.from,
        to: filter.to,
      });
    }

    // 팀/담당자 텍스트 필터 (옵션)
    if (filter.qTeam) {
      qb.andWhere('t.name LIKE :qTeam', { qTeam: `%${filter.qTeam}%` });
    }
    if (filter.qSalesperson) {
      qb.andWhere('acc.name LIKE :qSalesperson', {
        qSalesperson: `%${filter.qSalesperson}%`,
      });
    }

    // 1) 전체 요약
    const totalsRow = await qb
      .clone()
      .select([
        'COUNT(DISTINCT c.id) AS totalContracts',
        'SUM(ca.finalAmount) AS totalAmount',
        "SUM(CASE WHEN ca.role = 'company' THEN ca.finalAmount ELSE 0 END) AS companyAmount",
        "SUM(CASE WHEN ca.role = 'staff' THEN ca.finalAmount ELSE 0 END) AS staffAmount",
      ])
      .getRawOne<{
        totalContracts: string;
        totalAmount: string | null;
        companyAmount: string | null;
        staffAmount: string | null;
      }>();

    const summary: FinanceSummary = {
      totalContracts: Number(totalsRow?.totalContracts ?? 0),
      totalAmount: Number(totalsRow?.totalAmount ?? 0),
      companyAmount: Number(totalsRow?.companyAmount ?? 0),
      staffAmount: Number(totalsRow?.staffAmount ?? 0),
    };

    // 2) 사원별 집계 (staff만)
    const bySalespersonRows = await qb
      .clone()
      .andWhere("ca.role = 'staff'")
      .select([
        'acc.id AS salespersonId',
        'acc.name AS salespersonName',
        't.name AS teamName',
        'COUNT(DISTINCT c.id) AS contractCount',
        'SUM(ca.finalAmount) AS totalAmount',
      ])
      .groupBy('acc.id')
      .addGroupBy('acc.name')
      .addGroupBy('t.id')
      .addGroupBy('t.name')
      .orderBy('totalAmount', 'DESC')
      .addOrderBy('acc.name', 'ASC')
      .getRawMany<{
        salespersonId: string | null;
        salespersonName: string | null;
        teamName: string | null;
        contractCount: string;
        totalAmount: string | null;
      }>();

    const bySalesperson = bySalespersonRows.map((r) => ({
      salespersonId: r.salespersonId ? Number(r.salespersonId) : null,
      salespersonName: r.salespersonName,
      teamName: r.teamName,
      contractCount: Number(r.contractCount ?? 0),
      totalAmount: Number(r.totalAmount ?? 0),
    }));

    // 3) 팀별 집계 (staff만)
    const byTeamRows = await qb
      .clone()
      .andWhere("ca.role = 'staff'")
      .select([
        't.id AS teamId',
        't.name AS teamName',
        'COUNT(DISTINCT c.id) AS contractCount',
        'SUM(ca.finalAmount) AS totalAmount',
      ])
      .groupBy('t.id')
      .addGroupBy('t.name')
      .orderBy('totalAmount', 'DESC')
      .addOrderBy('t.name', 'ASC')
      .getRawMany<{
        teamId: string | null;
        teamName: string | null;
        contractCount: string;
        totalAmount: string | null;
      }>();

    const byTeam = byTeamRows.map((r) => ({
      teamId: r.teamId ? Number(r.teamId) : null,
      teamName: r.teamName,
      contractCount: Number(r.contractCount ?? 0),
      totalAmount: Number(r.totalAmount ?? 0),
    }));

    return {
      summary,
      bySalesperson,
      byTeam,
    };
  }

  // =========================
  // 5. 사원/팀 실적 필터 빌더
  // =========================
  buildPerformanceFilter(query: any): PerformanceFilter {
    const periodValues: PeriodFilter[] = [
      'today',
      'week',
      'month',
      'quarter',
      'half',
      'year',
      'custom',
    ];

    const period =
      (periodValues.find((v) => v === query.period) as
        | PeriodFilter
        | undefined) ?? 'month';

    const from = typeof query.from === 'string' ? query.from : undefined;
    const to = typeof query.to === 'string' ? query.to : undefined;

    return {
      period,
      from,
      to,
      qTeam: query.qTeam || undefined,
      qSalesperson: query.qSalesperson || undefined,
    };
  }

  // =========================
  // 6. 사원/팀 실적 집계
  // =========================
  async getPerformance(filter: PerformanceFilter): Promise<PerformanceResult> {
    // 1) 계약 기준: 사원/팀별 완료 계약 건수
    const contractQb = this.contractRepo
      .createQueryBuilder('c')
      .leftJoin('c.salesperson', 'acc')
      .leftJoin(
        'team_members',
        'tm',
        'tm.account_id = acc.id AND tm.is_primary = 1',
      )
      .leftJoin('teams', 't', 't.id = tm.team_id')
      .where('c.status = :status', { status: 'done' });

    // 기간 필터 (contractDate 기준)
    if (filter.period !== 'custom') {
      const { from, to } = this.buildPeriodRange(filter.period);
      if (from && to) {
        contractQb.andWhere('c.contractDate BETWEEN :from AND :to', {
          from,
          to,
        });
      }
    } else if (filter.from && filter.to) {
      contractQb.andWhere('c.contractDate BETWEEN :from AND :to', {
        from: filter.from,
        to: filter.to,
      });
    }

    // 팀/담당자 텍스트 필터
    if (filter.qTeam) {
      contractQb.andWhere('t.name LIKE :qTeam', {
        qTeam: `%${filter.qTeam}%`,
      });
    }
    if (filter.qSalesperson) {
      contractQb.andWhere('acc.name LIKE :qSalesperson', {
        qSalesperson: `%${filter.qSalesperson}%`,
      });
    }

    // 1-1) 사원별 완료 계약 수
    const contractStaffRows = await contractQb
      .clone()
      .select([
        'acc.id AS salespersonId',
        'acc.name AS salespersonName',
        't.name AS teamName',
        'COUNT(*) AS contractCount',
      ])
      .groupBy('acc.id')
      .addGroupBy('acc.name')
      .addGroupBy('t.id')
      .addGroupBy('t.name')
      .orderBy('contractCount', 'DESC')
      .addOrderBy('acc.name', 'ASC')
      .getRawMany<{
        salespersonId: string | null;
        salespersonName: string | null;
        teamName: string | null;
        contractCount: string;
      }>();

    const contractsByStaff: StaffContractPerformanceRow[] =
      contractStaffRows.map((r) => ({
        salespersonId: r.salespersonId ? Number(r.salespersonId) : null,
        salespersonName: r.salespersonName,
        teamName: r.teamName,
        contractCount: Number(r.contractCount ?? 0),
      }));

    // 1-2) 팀별 완료 계약 수
    const contractTeamRows = await contractQb
      .clone()
      .select([
        't.id AS teamId',
        't.name AS teamName',
        'COUNT(*) AS contractCount',
      ])
      .groupBy('t.id')
      .addGroupBy('t.name')
      .orderBy('contractCount', 'DESC')
      .addOrderBy('t.name', 'ASC')
      .getRawMany<{
        teamId: string | null;
        teamName: string | null;
        contractCount: string;
      }>();

    const contractsByTeam: TeamContractPerformanceRow[] = contractTeamRows.map(
      (r) => ({
        teamId: r.teamId ? Number(r.teamId) : null,
        teamName: r.teamName,
        contractCount: Number(r.contractCount ?? 0),
      }),
    );

    // 2) 답사 완료 기준: pins.surveyedBy / surveyedAt
    const pinRepo = this.dataSource.getRepository(Pin);
    const pinQb = pinRepo
      .createQueryBuilder('p')
      .leftJoin('accounts', 'acc', 'acc.id = p.surveyed_by')
      .leftJoin(
        'team_members',
        'tm',
        'tm.account_id = acc.id AND tm.is_primary = 1',
      )
      .leftJoin('teams', 't', 't.id = tm.team_id')
      .where('p.surveyed_by IS NOT NULL')
      .andWhere('p.is_deleted = 0');

    // 기간 필터 (surveyed_at 기준)
    if (filter.period !== 'custom') {
      const { from, to } = this.buildPeriodRange(filter.period);
      if (from && to) {
        pinQb.andWhere('p.surveyed_at BETWEEN :from AND :to', { from, to });
      }
    } else if (filter.from && filter.to) {
      pinQb.andWhere('p.surveyed_at BETWEEN :from AND :to', {
        from: filter.from,
        to: filter.to,
      });
    }

    if (filter.qTeam) {
      pinQb.andWhere('t.name LIKE :qTeam', { qTeam: `%${filter.qTeam}%` });
    }
    if (filter.qSalesperson) {
      pinQb.andWhere('acc.name LIKE :qSalesperson', {
        qSalesperson: `%${filter.qSalesperson}%`,
      });
    }

    const surveyRows = await pinQb
      .clone()
      .select([
        'acc.id AS accountId',
        'acc.name AS accountName',
        't.name AS teamName',
        'COUNT(*) AS surveyCount',
      ])
      .groupBy('acc.id')
      .addGroupBy('acc.name')
      .addGroupBy('t.id')
      .addGroupBy('t.name')
      .orderBy('surveyCount', 'DESC')
      .addOrderBy('acc.name', 'ASC')
      .getRawMany<{
        accountId: string | null;
        accountName: string | null;
        teamName: string | null;
        surveyCount: string;
      }>();

    const surveysByStaff: StaffSurveyPerformanceRow[] = surveyRows.map((r) => ({
      accountId: r.accountId ? Number(r.accountId) : null,
      accountName: r.accountName,
      teamName: r.teamName,
      surveyCount: Number(r.surveyCount ?? 0),
    }));

    // 3) 현재 답사 예정: survey_reservations (미래 예약 + is_deleted = 0)
    const surveyRepo = this.dataSource.getRepository(SurveyReservation);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

    const scheduledQb = surveyRepo
      .createQueryBuilder('r')
      .innerJoin('r.assignee', 'acc')
      .leftJoin(
        'team_members',
        'tm',
        'tm.account_id = acc.id AND tm.is_primary = 1',
      )
      .leftJoin('teams', 't', 't.id = tm.team_id')
      .where('r.is_deleted = 0')
      .andWhere('r.reserved_date >= :today', { today: todayStr });

    if (filter.qTeam) {
      scheduledQb.andWhere('t.name LIKE :qTeam', {
        qTeam: `%${filter.qTeam}%`,
      });
    }
    if (filter.qSalesperson) {
      scheduledQb.andWhere('acc.name LIKE :qSalesperson', {
        qSalesperson: `%${filter.qSalesperson}%`,
      });
    }

    const scheduledRows = await scheduledQb
      .clone()
      .select([
        'acc.id AS accountId',
        'acc.name AS accountName',
        't.name AS teamName',
        'COUNT(*) AS scheduledCount',
      ])
      .groupBy('acc.id')
      .addGroupBy('acc.name')
      .addGroupBy('t.id')
      .addGroupBy('t.name')
      .orderBy('scheduledCount', 'DESC')
      .addOrderBy('acc.name', 'ASC')
      .getRawMany<{
        accountId: string | null;
        accountName: string | null;
        teamName: string | null;
        scheduledCount: string;
      }>();

    const scheduledByStaff: StaffScheduledSurveyRow[] = scheduledRows.map(
      (r) => ({
        accountId: r.accountId ? Number(r.accountId) : null,
        accountName: r.accountName,
        teamName: r.teamName,
        scheduledCount: Number(r.scheduledCount ?? 0),
      }),
    );

    return {
      contractsByStaff,
      contractsByTeam,
      surveysByStaff,
      scheduledByStaff,
    };
  }

  // =========================
  // 7. 핀 통계 필터 빌더
  // =========================
  buildPinStatsFilter(query: any): PinStatsFilter {
    const periodValues: PeriodFilter[] = [
      'today',
      'week',
      'month',
      'quarter',
      'half',
      'year',
      'custom',
    ];

    const period =
      (periodValues.find((v) => v === query.period) as
        | PeriodFilter
        | undefined) ?? 'month';

    const from = typeof query.from === 'string' ? query.from : undefined;
    const to = typeof query.to === 'string' ? query.to : undefined;

    const cityValues: PinCityFilter[] = ['all', 'seoul', 'incheon', 'gyeonggi'];
    const city =
      (cityValues.find((v) => v === query.city) as PinCityFilter | undefined) ??
      'all';

    return {
      period,
      from,
      to,
      city,
    };
  }

  // =========================
  // 8. 핀 통계 집계
  // =========================
  async getPinStats(filter: PinStatsFilter): Promise<PinStatsResult> {
    const pinRepo = this.dataSource.getRepository(Pin);
    const draftRepo = this.dataSource.getRepository(PinDraft);
    const resvRepo = this.dataSource.getRepository(SurveyReservation);

    const range =
      filter.period !== 'custom'
        ? this.buildPeriodRange(filter.period)
        : { from: filter.from, to: filter.to };

    // 1) 도시별 핀 수
    const cityRows = await (() => {
      const qb = pinRepo
        .createQueryBuilder('p')
        .where('p.is_deleted = 0')
        .andWhere('p.is_disabled = 0');

      if (range.from && range.to) {
        qb.andWhere('p.created_at BETWEEN :from AND :to', range);
      }

      this.applyCityFilter(qb, 'p', filter.city);

      const cityCase = this.buildCityCaseExpression('p.address_line');

      qb.select(cityCase, 'cityKey').addSelect('COUNT(*)', 'count');
      qb.groupBy('cityKey');

      return qb.getRawMany<{ cityKey: string | null; count: string }>();
    })();

    const cityStats: PinCityStat[] = cityRows.map((row) => {
      const key = (row.cityKey as PinCityFilter | 'other' | null) ?? 'other';
      return {
        cityKey: key,
        cityLabel: this.getCityLabel(key),
        count: Number(row.count ?? 0),
      };
    });

    const totalPins = cityStats.reduce((sum, it) => sum + it.count, 0);
    const topCity =
      cityStats.length === 0
        ? null
        : cityStats.reduce(
            (max, cur) => (cur.count > max.count ? cur : max),
            cityStats[0],
          );

    // 2) 지역구별 핀 수 TOP 20
    const districtRows = await (() => {
      const qb = pinRepo
        .createQueryBuilder('p')
        .where('p.is_deleted = 0')
        .andWhere('p.is_disabled = 0');

      if (range.from && range.to) {
        qb.andWhere('p.created_at BETWEEN :from AND :to', range);
      }

      this.applyCityFilter(qb, 'p', filter.city);

      const districtExpr =
        "SUBSTRING_INDEX(SUBSTRING_INDEX(p.address_line, ' ', 2), ' ', -1)";

      qb.select(districtExpr, 'district')
        .addSelect('COUNT(*)', 'count')
        .andWhere(`${districtExpr} <> ''`)
        .groupBy('district')
        .orderBy('count', 'DESC')
        .addOrderBy('district', 'ASC')
        .limit(20);

      return qb.getRawMany<{ district: string | null; count: string }>();
    })();

    const districtStats: PinDistrictStat[] = districtRows.map((row) => ({
      district: row.district || '-',
      count: Number(row.count ?? 0),
    }));

    // 3) 답사전 임시핀 (예약 없는 활성 draft) 지역구별 TOP 20
    const draftBeforeRows = await (() => {
      const qb = draftRepo.createQueryBuilder('d').where('d.isActive = 1');

      if (range.from && range.to) {
        qb.andWhere('d.createdAt BETWEEN :from AND :to', range);
      }

      this.applyCityFilter(qb, 'd', filter.city);

      qb.andWhere((innerQb) => {
        const sub = innerQb
          .subQuery()
          .select('1')
          .from(SurveyReservation, 'r')
          .where('r.pin_draft_id = d.id')
          .andWhere('r.is_deleted = 0')
          .getQuery();
        return `NOT EXISTS (${sub})`;
      });

      const districtExpr =
        "SUBSTRING_INDEX(SUBSTRING_INDEX(d.address_line, ' ', 2), ' ', -1)";

      qb.select(districtExpr, 'district')
        .addSelect('COUNT(*)', 'count')
        .andWhere(`${districtExpr} <> ''`)
        .groupBy('district')
        .orderBy('count', 'DESC')
        .addOrderBy('district', 'ASC')
        .limit(20);

      return qb.getRawMany<{ district: string | null; count: string }>();
    })();

    const draftBeforeStats: PinDistrictStat[] = draftBeforeRows.map((row) => ({
      district: row.district || '-',
      count: Number(row.count ?? 0),
    }));

    // 4) 예약된 답사 예정 (survey_reservations + pin_drafts) 지역구별 TOP 20
    const scheduledRows = await (() => {
      const qb = resvRepo
        .createQueryBuilder('r')
        .innerJoin('r.pinDraft', 'd')
        .where('r.is_deleted = 0');

      if (range.from && range.to) {
        qb.andWhere('r.reservedDate BETWEEN :from AND :to', range);
      }

      this.applyCityFilter(qb, 'd', filter.city);

      const districtExpr =
        "SUBSTRING_INDEX(SUBSTRING_INDEX(d.address_line, ' ', 2), ' ', -1)";

      qb.select(districtExpr, 'district')
        .addSelect('COUNT(*)', 'count')
        .andWhere(`${districtExpr} <> ''`)
        .groupBy('district')
        .orderBy('count', 'DESC')
        .addOrderBy('district', 'ASC')
        .limit(20);

      return qb.getRawMany<{ district: string | null; count: string }>();
    })();

    const scheduledStats: PinDistrictStat[] = scheduledRows.map((row) => ({
      district: row.district || '-',
      count: Number(row.count ?? 0),
    }));

    const totalDraftBefore = draftBeforeStats.reduce(
      (sum, it) => sum + it.count,
      0,
    );
    const totalScheduled = scheduledStats.reduce(
      (sum, it) => sum + it.count,
      0,
    );

    const summary: PinStatsSummary = {
      totalPins,
      topCityLabel: topCity ? topCity.cityLabel : null,
      topCityCount: topCity ? topCity.count : 0,
      totalDraftBefore,
      totalScheduled,
    };

    return {
      filter,
      cityStats,
      districtStats,
      draftBeforeStats,
      scheduledStats,
      summary,
    };
  }

  // =========================
  // 9. 공통: 기간 계산
  // =========================
  private buildPeriodRange(period: PeriodFilter): {
    from?: string;
    to?: string;
  } {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);

    const fromDate = new Date(today.getTime());

    switch (period) {
      case 'today':
        return { from: to, to };
      case 'week':
        fromDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        fromDate.setMonth(today.getMonth() - 1);
        break;
      case 'quarter':
        fromDate.setMonth(today.getMonth() - 3);
        break;
      case 'half':
        fromDate.setMonth(today.getMonth() - 6);
        break;
      case 'year':
        fromDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        return {};
    }

    const from = fromDate.toISOString().slice(0, 10);
    return { from, to };
  }

  // =========================
  // 10. 공통: 도시 필터 / 라벨
  // =========================
  private applyCityFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    city: PinCityFilter,
  ) {
    if (city === 'all') return;

    const col = `${alias}.address_line`;
    if (city === 'seoul') {
      qb.andWhere(`${col} LIKE '서울%'`);
    } else if (city === 'incheon') {
      qb.andWhere(`${col} LIKE '인천%'`);
    } else if (city === 'gyeonggi') {
      qb.andWhere(`${col} LIKE '경기%'`);
    }
  }

  private buildCityCaseExpression(column: string): string {
    return `
      CASE
        WHEN ${column} LIKE '%서울%' THEN 'seoul'
        WHEN ${column} LIKE '%인천%' THEN 'incheon'
        WHEN ${column} LIKE '%경기%' THEN 'gyeonggi'
        ELSE 'other'
      END
    `;
  }

  private getCityLabel(key: PinCityFilter | 'other'): string {
    switch (key) {
      case 'seoul':
        return '서울';
      case 'incheon':
        return '인천';
      case 'gyeonggi':
        return '경기';
      default:
        return '기타';
    }
  }
}
