import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PerformanceFilterDto, FilterType } from './dto/performance-filter.dto';
import {
  PerformanceSummaryResponse,
  ResolvedRange,
  TeamEmployeesResponse,
  TeamSummary,
  TopTeam,
} from './types/performance.types';
import { Contract } from '../contracts/entities/contract.entity';
import { ContractAssignee } from '../contracts/assignees/entities/assignee.entity';
import { Team } from '../dashboard/accounts/entities/team.entity';
import { TeamMember } from '../dashboard/accounts/entities/team-member.entity';
import { Account } from '../dashboard/accounts/entities/account.entity';
import { AccountCredential } from '../dashboard/accounts/entities/account-credential.entity';
import { Schedule } from 'src/schedules/entities/schedule.entity';

const TAX_FACTOR = 0.967;
const VAT_RATE = 0.1;
const REBATE_UNIT_AMOUNT = 1_000_000;

type KstYmd = { y: number; m: number; d: number };

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(year: number, month: number): number {
  // month: 1~12
  return new Date(year, month, 0).getDate();
}

function getKstYmdToday(): KstYmd {
  // 서버가 UTC여도 KST 기준으로 “오늘”을 안정적으로 얻기 위해 Intl timeZone 사용
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'month')?.value ?? '0');
  const d = Number(parts.find((p) => p.type === 'day')?.value ?? '0');
  return { y, m, d };
}

@Injectable()
export class PerformanceService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    @InjectRepository(ContractAssignee)
    private readonly assigneeRepo: Repository<ContractAssignee>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepo: Repository<TeamMember>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(AccountCredential)
    private readonly credentialRepo: Repository<AccountCredential>,
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
  ) { }

  async getPlatformStatistics(dto: PerformanceFilterDto) {
    const range = this.resolveRange(dto);
    const { accountId } = dto;

    const query = this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoin('contracts', 'c', 'c.scheduleId = s.id')
      .select("CASE WHEN TRIM(s.platform) = '' OR s.platform IS NULL THEN '미지정' ELSE TRIM(s.platform) END", 'platform')
      // 계약 완료 건수 (한 명의 고객/현장에 대해 성사된 계약이 있다면 1건으로 집계)
      .addSelect(`
        COUNT(DISTINCT CASE 
          WHEN c.status = 'done' THEN c.id
          WHEN c.id IS NULL AND EXISTS (
            SELECT 1 FROM contracts c2 
            WHERE c2.customerPhone = s.customer_phone 
            AND c2.siteName = s.location 
            AND c2.status = 'done'
          ) THEN (
            SELECT c3.id FROM contracts c3 
            WHERE c3.customerPhone = s.customer_phone 
            AND c3.siteName = s.location 
            AND c3.status = 'done'
            LIMIT 1
          )
          ELSE NULL END
        )`, 'contracted_count')

      // 부결/해약 (연결된 계약이 rejected 또는 canceled이고, 동일인/현장으로 성사된 건이 없는 경우)
      .addSelect(`
        COUNT(DISTINCT CASE 
          WHEN (c.status = 'rejected' OR c.status = 'canceled') AND NOT EXISTS (
            SELECT 1 FROM contracts c3 
            WHERE c3.customerPhone = s.customer_phone 
            AND c3.siteName = s.location 
            AND c3.status = 'done'
          ) THEN s.id 
          ELSE NULL END
        )`, 'rejected')
      // 미팅 취소 (일정 상태가 canceled이고, 동일인/현장으로 성사된 건이 없는 경우)
      .addSelect(`
        COUNT(DISTINCT CASE 
          WHEN s.status = 'canceled' AND NOT EXISTS (
            SELECT 1 FROM contracts c4 
            WHERE c4.customerPhone = s.customer_phone 
            AND c4.siteName = s.location 
            AND c4.status = 'done'
          ) THEN s.id 
          ELSE NULL END
        )`, 'canceled')
      // 신규 (정상 상태, 미팅타입 '신규', 계약 없음, 동일인/현장 성공 건 없음)
      .addSelect(`
        COUNT(DISTINCT CASE 
          WHEN s.status = 'normal' AND s.meeting_type = '신규' AND c.id IS NULL AND NOT EXISTS (
            SELECT 1 FROM contracts c5 
            WHERE c5.customerPhone = s.customer_phone 
            AND c5.siteName = s.location 
            AND c5.status = 'done'
          ) THEN s.id 
          ELSE NULL END
        )`, 'new_meeting')
      // 재미팅 (정상 상태, 미팅타입 '재미팅', 계약 없음, 동일인/현장 성공 건 없음)
      .addSelect(`
        COUNT(DISTINCT CASE 
          WHEN s.status = 'normal' AND s.meeting_type = '재미팅' AND c.id IS NULL AND NOT EXISTS (
            SELECT 1 FROM contracts c6 
            WHERE c6.customerPhone = s.customer_phone 
            AND c6.siteName = s.location 
            AND c6.status = 'done'
          ) THEN s.id 
          ELSE NULL END
        )`, 're_meeting')
      .where('s.is_deleted = :isDeleted', { isDeleted: false })
      .andWhere("s.meeting_type != '휴무'")
      .andWhere('s.start_date >= :s AND s.start_date <= :e', {
        s: range.startDate,
        e: range.endDate,
      });

    if (accountId) {
      query.andWhere('s.created_by_account_id = :aid', { aid: accountId });
    }

    const rows = await query
      .groupBy("CASE WHEN TRIM(s.platform) = '' OR s.platform IS NULL THEN '미지정' ELSE TRIM(s.platform) END")
      .orderBy('contracted_count', 'DESC')
      .getRawMany();

    return {
      resolvedRange: range,
      statistics: rows.map(r => ({
        platform: r.platform || '기타',
        newCount: Number(r.new_meeting || 0),
        reCount: Number(r.re_meeting || 0),
        canceledCount: Number(r.canceled || 0),
        contractedCount: Number(r.contracted_count || 0),
        rejectedCount: Number(r.rejected || 0),
        totalCount: Number(r.new_meeting || 0) + Number(r.re_meeting || 0) + Number(r.canceled || 0) + Number(r.contracted_count || 0) + Number(r.rejected || 0)
      }))
    };
  }

  private resolveRange(dto: PerformanceFilterDto): ResolvedRange {
    const type: FilterType = dto.filterType ?? 'THIS_MONTH';

    if (type === 'THIS_MONTH') {
      const today = getKstYmdToday();
      const startDate = `${today.y}-${pad2(today.m)}-01`;
      const endDate = `${today.y}-${pad2(today.m)}-${pad2(lastDayOfMonth(today.y, today.m))}`;
      return {
        startDate,
        endDate,
        label: `${today.y}년 ${today.m}월`,
      };
    }

    if (type === 'MONTH') {
      if (!dto.year || !dto.month) {
        throw new BadRequestException('MONTH는 year, month가 필요합니다.');
      }
      const y = dto.year;
      const m = dto.month;
      const startDate = `${y}-${pad2(m)}-01`;
      const endDate = `${y}-${pad2(m)}-${pad2(lastDayOfMonth(y, m))}`;
      return { startDate, endDate, label: `${y}년 ${m}월` };
    }

    if (type === 'QUARTER') {
      if (!dto.year || !dto.quarter) {
        throw new BadRequestException('QUARTER는 year, quarter가 필요합니다.');
      }
      const y = dto.year;
      const q = dto.quarter;
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const startDate = `${y}-${pad2(startMonth)}-01`;
      const endDate = `${y}-${pad2(endMonth)}-${pad2(lastDayOfMonth(y, endMonth))}`;
      return { startDate, endDate, label: `${y}년 ${q}분기` };
    }

    if (type === 'ALL') {
      return {
        startDate: '2000-01-01',
        endDate: '2099-12-31',
        label: '전체',
      };
    }

    // YEAR
    if (!dto.year) {
      throw new BadRequestException('YEAR는 year가 필요합니다.');
    }
    const y = dto.year;
    return {
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
      label: `${y}년`,
    };
  }

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

  private sqlCompanyAmountExpr(grandTotalExpr: string): string {
    return `ROUND( (${grandTotalExpr}) * (c.companyPercent / 100) )`;
  }

  private sqlMyAmountExpr(grandTotalExpr: string): string {
    // sharePercent는 전체 매출 대비 절대 비율이므로 grandTotal에 직접 곱함
    return `ROUND( (${grandTotalExpr}) * (COALESCE(a.sharePercent, 0) / 100) )`;
  }

  private sqlGrossSalesContribExpr(grandTotalExpr: string): string {
    // 개별 기여 매출 = 전체 매출 * (내 지분 / 전체 직원 지분 합계)
    // 전체 직원 지분 합계 = 100 - 회사비율
    return `ROUND( (${grandTotalExpr}) * (COALESCE(a.sharePercent, 0) / NULLIF(100 - c.companyPercent, 0)) )`;
  }

  private sqlNetProfitContribExpr(companyAmountExpr: string): string {
    // 개별 기여 순수익(회사의 수익) = 회사 수익 * (내 지분 / 전체 직원 지분 합계)
    return `ROUND( (${companyAmountExpr}) * (COALESCE(a.sharePercent, 0) / NULLIF(100 - c.companyPercent, 0)) )`;
  }

  async getSummary(dto: PerformanceFilterDto): Promise<PerformanceSummaryResponse> {
    const range = this.resolveRange(dto);

    const grandTotalExpr = this.sqlGrandTotalExpr();
    const companyAmountExpr = this.sqlCompanyAmountExpr(grandTotalExpr);

    // 1) 회사 KPI
    const companyRaw = await this.contractRepo
      .createQueryBuilder('c')
      .select(`COALESCE(SUM(${grandTotalExpr}), 0)`, 'grossSales')
      .addSelect(`COALESCE(SUM(${companyAmountExpr}), 0)`, 'netProfit')
      .addSelect(`COUNT(c.id)`, 'contractCount')
      .where('c.status = :done', { done: 'done' })
      .andWhere('c.contractDate >= :s AND c.contractDate <= :e', {
        s: range.startDate,
        e: range.endDate,
      })
      .getRawOne<{
        grossSales: string;
        netProfit: string;
        contractCount: string;
      }>();

    // 2) 총 인원수
    const headcount = await this.credentialRepo
      .createQueryBuilder('cr')
      .where('cr.is_disabled = :d', { d: false })
      .andWhere('cr.role != :admin', { admin: 'admin' })
      .getCount();

    // 3) 팀별 멤버 수
    const memberRows = await this.teamMemberRepo
      .createQueryBuilder('tm')
      .select('tm.team_id', 'teamId')
      .addSelect('COUNT(tm.id)', 'memberCount')
      .groupBy('tm.team_id')
      .getRawMany<{ teamId: string; memberCount: string }>();

    const memberCountMap = new Map<string, number>(
      memberRows.map((r) => [String(r.teamId), Number(r.memberCount)]),
    );

    // 4) 팀별 실적
    const myAmountExpr = this.sqlMyAmountExpr(grandTotalExpr);
    const gSalesContribExpr = this.sqlGrossSalesContribExpr(grandTotalExpr);
    const nProfitContribExpr = this.sqlNetProfitContribExpr(companyAmountExpr);

    const teamPerfRows = await this.teamRepo
      .createQueryBuilder('t')
      .leftJoin(
        ContractAssignee,
        'a',
        'a.team_id = t.id OR (a.team_id IS NULL AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.account_id = a.account_id AND tm.team_id = t.id))'
      )
      .leftJoin(
        Contract,
        'c',
        `
      c.id = a.contract_id
      AND c.status = :done
      AND c.contract_date >= :s
      AND c.contract_date <= :e
    `,
        {
          done: 'done',
          s: range.startDate,
          e: range.endDate,
        },
      )
      .select('t.id', 'teamId')
      .addSelect('t.name', 'teamName')
      .addSelect(`COALESCE(SUM(${myAmountExpr}), 0)`, 'finalPayout')
      .addSelect(`COALESCE(SUM(${gSalesContribExpr}), 0)`, 'grossSales')
      .addSelect(`COALESCE(SUM(${nProfitContribExpr}), 0)`, 'netProfit')
      .addSelect('COUNT(DISTINCT c.id)', 'contractCount')
      .where('t.is_active = :act', { act: true })
      .groupBy('t.id')
      .addGroupBy('t.name')
      .orderBy('finalPayout', 'DESC')
      .getRawMany<{
        teamId: string;
        teamName: string;
        finalPayout: string;
        grossSales: string;
        netProfit: string;
        contractCount: string;
      }>();

    const teams: TeamSummary[] = teamPerfRows.map((r) => ({
      teamId: String(r.teamId),
      teamName: String(r.teamName),
      finalPayout: Number(r.finalPayout),
      grossSales: Number(r.grossSales),
      netProfit: Number(r.netProfit),
      contractCount: Number(r.contractCount),
      memberCount: memberCountMap.get(String(r.teamId)) ?? 0,
    }));

    const topTeams: TopTeam[] = teams.slice(0, 3).map((t, idx) => ({
      teamId: t.teamId,
      teamName: t.teamName,
      finalPayout: t.finalPayout,
      grossSales: t.grossSales,
      netProfit: t.netProfit,
      contractCount: t.contractCount,
      rank: (idx + 1) as 1 | 2 | 3,
    }));

    return {
      resolvedRange: range,
      company: {
        grossSales: Number(companyRaw?.grossSales ?? 0),
        netProfit: Number(companyRaw?.netProfit ?? 0),
        contractCount: Number(companyRaw?.contractCount ?? 0),
        headcount,
      },
      teams,
      topTeams,
    };
  }

  async getTeamEmployees(
    teamId: string,
    dto: PerformanceFilterDto,
  ): Promise<TeamEmployeesResponse> {
    const range = this.resolveRange(dto);

    const team = await this.teamRepo.findOne({
      where: { id: String(teamId) } as any,
    });
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');

    const grandTotalExpr = this.sqlGrandTotalExpr();
    const companyAmountExpr = this.sqlCompanyAmountExpr(grandTotalExpr);
    const myAmountExpr = this.sqlMyAmountExpr(grandTotalExpr);
    const gSalesContribExpr = this.sqlGrossSalesContribExpr(grandTotalExpr);
    const nProfitContribExpr = this.sqlNetProfitContribExpr(companyAmountExpr);

    // - 기준: team_members + accounts
    // - 계약 필터(완료/기간)는 Contract LEFT JOIN의 ON에 붙여야 0이 살아있음
    const rows = await this.accountRepo
      .createQueryBuilder('acc')
      .innerJoin(
        TeamMember,
        'tm',
        'tm.account_id = acc.id AND tm.team_id = :tid',
        { tid: String(teamId) },
      )
      .leftJoin(AccountCredential, 'cr', 'cr.id = acc.credential_id')
      .leftJoin(
        ContractAssignee, 
        'a', 
        'a.account_id = acc.id AND (a.team_id = :tid OR (a.team_id IS NULL AND EXISTS (SELECT 1 FROM team_members tm2 WHERE tm2.account_id = a.account_id AND tm2.team_id = :tid)))'
      )
      .leftJoin(
        Contract,
        'c',
        `
        c.id = a.contract_id
        AND c.status = :done
        AND c.contract_date >= :s
        AND c.contract_date <= :e
      `,
        {
          done: 'done',
          s: range.startDate,
          e: range.endDate,
        },
      )
      .select('acc.id', 'accountId')
      .addSelect('acc.name', 'name')
      .addSelect('acc.position_rank', 'positionRank')
      .addSelect(`COALESCE(SUM(${myAmountExpr}), 0)`, 'finalPayout')
      .addSelect(`COALESCE(SUM(${gSalesContribExpr}), 0)`, 'grossSales')
      .addSelect(`COALESCE(SUM(${nProfitContribExpr}), 0)`, 'netProfit')
      .addSelect('COUNT(DISTINCT c.id)', 'contractCount')
      // 팀원 리스트는 다 보여주되, 비활성 credential은 제외(너가 "비활성은 사실상 안 쓰지만"이라고 했으니 최소 안전장치)
      .where('(cr.is_disabled = 0 OR cr.is_disabled IS NULL)')
      .andWhere('cr.role != :admin', { admin: 'admin' })
      .groupBy('acc.id')
      .addGroupBy('acc.name')
      .addGroupBy('acc.position_rank')
      // 정렬: 실적 높은 순, 동률이면 이름/ID로 안정 정렬
      .orderBy('finalPayout', 'DESC')
      .addOrderBy('acc.name', 'ASC')
      .addOrderBy('acc.id', 'ASC')
      .getRawMany<{
        accountId: string;
        name: string | null;
        positionRank: string | null;
        finalPayout: string;
        grossSales: string;
        netProfit: string;
        contractCount: string;
      }>();

    return {
      resolvedRange: range,
      team: { teamId: String(team.id), teamName: team.name },
      employees: rows.map((r) => ({
        accountId: String(r.accountId),
        name: r.name ?? null,
        positionRank: r.positionRank ?? null,
        finalPayout: Number(r.finalPayout),
        grossSales: Number(r.grossSales),
        netProfit: Number(r.netProfit),
        contractCount: Number(r.contractCount),
      })),
    };
  }

  /**
   * 모든 활성 직원 목록 조회 (영업자별 실적 탭 버튼용)
   */
  async listEmployees() {
    return this.accountRepo
      .createQueryBuilder('acc')
      .innerJoin('acc.credential', 'cr')
      .select([
        'acc.id AS id',
        'acc.name AS name',
        'acc.position_rank AS positionRank',
        'cr.role AS role',
      ])
      .where('acc.is_deleted = false')
      .andWhere('(cr.is_disabled = false OR cr.is_disabled IS NULL)')
      .andWhere('cr.role != :admin', { admin: 'admin' })
      .orderBy('acc.name', 'ASC')
      .getRawMany();
  }

  /**
   * 특정 직원의 월별 실적 추이 조회 (영업자별 실적 탭 상세용)
   */
  async getEmployeePerformance(
    accountId: string,
    year: number,
  ): Promise<any> {
    const account = await this.accountRepo.findOne({
      where: { id: String(accountId) } as any,
    });
    if (!account) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    const grandTotalExpr = this.sqlGrandTotalExpr();
    const companyAmountExpr = this.sqlCompanyAmountExpr(grandTotalExpr);
    const myAmountExpr = this.sqlMyAmountExpr(grandTotalExpr);
    
    // 영업자 개인 뷰에서는 '기여 매출'을 쪼개지 않고 해당 계약의 전체 금액(grandTotal)으로 보여줌
    const gSalesFullExpr = grandTotalExpr; 
    const nProfitContribExpr = this.sqlNetProfitContribExpr(companyAmountExpr);

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // 월별 실적 조회
    const rows = await this.contractRepo
      .createQueryBuilder('c')
      .innerJoin(ContractAssignee, 'a', 'a.contract_id = c.id')
      .select('MONTH(c.contract_date)', 'month')
      .addSelect(`COALESCE(SUM(${myAmountExpr}), 0)`, 'finalPayout')
      .addSelect(`COALESCE(SUM(${gSalesFullExpr}), 0)`, 'grossSales')
      .addSelect(`COALESCE(SUM(${nProfitContribExpr}), 0)`, 'netProfit')
      .addSelect('COUNT(DISTINCT c.id)', 'contractCount')
      .where('a.account_id = :aid', { aid: String(accountId) })
      .andWhere('c.status = :done', { done: 'done' })
      .andWhere('c.contract_date >= :s AND c.contract_date <= :e', {
        s: startDate,
        e: endDate,
      })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany<{
        month: string | number;
        finalPayout: string;
        grossSales: string;
        netProfit: string;
        contractCount: string;
      }>();

    // 1~12월 데이터 보장
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const found = rows.find((r) => Number(r.month) === m);
      return {
        year,
        month: m,
        grossSales: Number(found?.grossSales ?? 0),
        netProfit: Number(found?.netProfit ?? 0),
        finalPayout: Number(found?.finalPayout ?? 0),
        contractCount: Number(found?.contractCount ?? 0),
      };
    });

    return {
      accountId: String(account.id),
      name: account.name,
      positionRank: account.position_rank,
      monthlyStats,
    };
  }

  /**
   * 데이터가 존재하는 연도와 월 목록 조회
   */
  async getAvailablePeriods() {
    // 1. 일정 데이터가 있는 연도/월
    const scheduleRows = await this.scheduleRepo
      .createQueryBuilder('s')
      .select('YEAR(s.start_date)', 'year')
      .addSelect('MONTH(s.start_date)', 'month')
      .where('s.is_deleted = :isDeleted', { isDeleted: false })
      .andWhere("s.meeting_type != '휴무'")
      .groupBy('year')
      .addGroupBy('month')
      .getRawMany<{ year: number; month: number }>();

    // 2. 계약 데이터가 있는 연도/월 (성공한 계약 기준)
    const contractRows = await this.contractRepo
      .createQueryBuilder('c')
      .select('YEAR(c.contract_date)', 'year')
      .addSelect('MONTH(c.contract_date)', 'month')
      .where('c.status = :done', { done: 'done' })
      .groupBy('year')
      .addGroupBy('month')
      .getRawMany<{ year: number; month: number }>();

    // 3. 데이터 통합 및 중복 제거
    const all = [...scheduleRows, ...contractRows];
    const yearMonthMap = new Map<number, Set<number>>();

    all.forEach(r => {
      const y = Number(r.year);
      const m = Number(r.month);
      if (!y || !m) return;
      
      let monthSet = yearMonthMap.get(y);
      if (!monthSet) {
        monthSet = new Set<number>();
        yearMonthMap.set(y, monthSet);
      }
      monthSet.add(m);
    });

    const years = Array.from(yearMonthMap.keys()).sort((a, b) => b - a);
    const yearMonths: { year: number; month: number }[] = [];
    
    years.forEach(y => {
      const monthSet = yearMonthMap.get(y);
      if (monthSet) {
        const sortedMonths = Array.from(monthSet).sort((a, b) => b - a);
        sortedMonths.forEach(m => {
          yearMonths.push({ year: y, month: m });
        });
      }
    });

    return { years, yearMonths };
  }
}
