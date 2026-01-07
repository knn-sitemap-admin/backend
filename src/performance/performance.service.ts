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
  ) {}

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
      )
    `;
  }

  private sqlCompanyAmountExpr(grandTotalExpr: string): string {
    // companyAmount = round(grandTotal * (companyPercent/100))
    return `ROUND( (${grandTotalExpr}) * (c.companyPercent / 100) )`;
  }

  private sqlStaffPoolExpr(
    grandTotalExpr: string,
    companyAmountExpr: string,
  ): string {
    return `( (${grandTotalExpr}) - (${companyAmountExpr}) )`;
  }

  private sqlMyAmountExpr(staffPoolExpr: string): string {
    // myAmount = round(staffPool * (sharePercent/100))
    return `ROUND( (${staffPoolExpr}) * (a.sharePercent / 100) )`;
  }

  async getSummary(
    dto: PerformanceFilterDto,
  ): Promise<PerformanceSummaryResponse> {
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
      .andWhere('c.finalPaymentDate >= :s AND c.finalPaymentDate <= :e', {
        s: range.startDate,
        e: range.endDate,
      })
      .getRawOne<{
        grossSales: string;
        netProfit: string;
        contractCount: string;
      }>();

    // 2) 총 인원수(비활성 제외)
    // - 요구사항: 하드딜리트라 accounts.is_deleted는 의미 없고, is_disabled만 활성 판단으로 사용
    const headcount = await this.credentialRepo
      .createQueryBuilder('cr')
      .where('cr.is_disabled = :d', { d: false })
      .getCount();

    // 3) 팀 인원수 맵(기간 무관, team_members 기준)
    const memberRows = await this.teamMemberRepo
      .createQueryBuilder('tm')
      .select('tm.team_id', 'teamId')
      .addSelect('COUNT(tm.id)', 'memberCount')
      .groupBy('tm.team_id')
      .getRawMany<{ teamId: string; memberCount: string }>();

    const memberCountMap = new Map<string, number>(
      memberRows.map((r) => [String(r.teamId), Number(r.memberCount)]),
    );

    // 4) 팀별 실적 (0 포함 버전)
    const staffPoolExpr = this.sqlStaffPoolExpr(
      grandTotalExpr,
      companyAmountExpr,
    );
    const myAmountExpr = this.sqlMyAmountExpr(staffPoolExpr);

    // ※ 핵심: 완료/기간 조건을 WHERE가 아니라 JOIN ON으로 넣어야 0팀이 살아있음
    const teamPerfRows = await this.teamRepo
      .createQueryBuilder('t')
      .leftJoin(TeamMember, 'tm', 'tm.team_id = t.id')
      .leftJoin(ContractAssignee, 'a', 'a.account_id = tm.account_id')
      .leftJoin(
        Contract,
        'c',
        `
      c.id = a.contract_id
      AND c.status = :done
      AND c.final_payment_date >= :s
      AND c.final_payment_date <= :e
    `,
        {
          done: 'done',
          s: range.startDate,
          e: range.endDate,
        },
      )
      .select('t.id', 'teamId')
      .addSelect('t.name', 'teamName')
      // c가 NULL이면 myAmountExpr도 NULL로 흐르므로 SUM 결과가 NULL될 수 있어 COALESCE로 0 처리
      .addSelect(`COALESCE(SUM(${myAmountExpr}), 0)`, 'finalPayout')
      // 계약건수는 c.id 기준 distinct. c가 NULL이면 카운트 0.
      .addSelect('COUNT(DISTINCT c.id)', 'contractCount')
      .where('t.is_active = :act', { act: true })
      .groupBy('t.id')
      .addGroupBy('t.name')
      .orderBy('finalPayout', 'DESC')
      .getRawMany<{
        teamId: string;
        teamName: string;
        finalPayout: string;
        contractCount: string;
      }>();

    const teams: TeamSummary[] = teamPerfRows.map((r) => ({
      teamId: String(r.teamId),
      teamName: String(r.teamName),
      finalPayout: Number(r.finalPayout),
      contractCount: Number(r.contractCount),
      memberCount: memberCountMap.get(String(r.teamId)) ?? 0,
    }));

    const topTeams: TopTeam[] = teams.slice(0, 3).map((t, idx) => ({
      teamId: t.teamId,
      teamName: t.teamName,
      finalPayout: t.finalPayout,
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
    const staffPoolExpr = this.sqlStaffPoolExpr(
      grandTotalExpr,
      companyAmountExpr,
    );
    const myAmountExpr = this.sqlMyAmountExpr(staffPoolExpr);

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
      .leftJoin(ContractAssignee, 'a', 'a.account_id = acc.id')
      .leftJoin(
        Contract,
        'c',
        `
        c.id = a.contract_id
        AND c.status = :done
        AND c.final_payment_date >= :s
        AND c.final_payment_date <= :e
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
      .addSelect('COUNT(DISTINCT c.id)', 'contractCount')
      // 팀원 리스트는 다 보여주되, 비활성 credential은 제외(너가 "비활성은 사실상 안 쓰지만"이라고 했으니 최소 안전장치)
      .where('(cr.is_disabled = 0 OR cr.is_disabled IS NULL)')
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
        contractCount: Number(r.contractCount),
      })),
    };
  }
}
