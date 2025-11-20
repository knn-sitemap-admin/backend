import { Controller, Get, Query, Render, UseGuards } from '@nestjs/common';
import {
  ContractListFilter,
  FinanceFilter,
  PerformanceFilter,
  PeriodFilter,
  PinCityFilter,
  PinStatsFilter,
  SortDir,
  SortKey,
  StatusFilter,
} from './types/adminType';
import { OwnerService } from './owner.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Team } from '../dashboard/accounts/entities/team.entity';
import { Repository } from 'typeorm';
import { OwnerAdminGuard } from './owner-admin.guard';

type ContractsQuery = {
  status?: string;
  period?: string;
  from?: string;
  to?: string;
  qCustomer?: string;
  qSalesperson?: string;
  qTeam?: string;
  sort?: string;
  dir?: string;
  page?: string;
  pageSize?: string;

  idFrom?: string;
  idTo?: string;
  grandMin?: string;
  grandMax?: string;
};

type FinanceQuery = {
  period?: string;
  from?: string;
  to?: string;
  qTeam?: string;
  qSalesperson?: string;
};

type PerformanceQuery = {
  period?: string;
  from?: string;
  to?: string;
  qTeam?: string;
  qSalesperson?: string;
};

type PinsQuery = {
  city?: string;
  period?: string;
  from?: string;
  to?: string;
};

@UseGuards(OwnerAdminGuard)
@Controller('owner')
export class OwnerController {
  constructor(
    private readonly ownerService: OwnerService,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  // 대시보드
  @Get()
  @Render('owner/dashboard')
  async dashboard() {
    const summary = await this.ownerService.getDashboardSummary();

    return {
      pageTitle: '대시보드',
      summary,
    };
  }

  // 계약 리스트 페이지
  @Get('contracts')
  @Render('owner/contracts')
  async contracts(@Query() query: ContractsQuery) {
    const filter = this.buildContractsFilter(query);
    const result = await this.ownerService.getContractsList(filter);

    // 팀 리스트 가져오기
    const teams = await this.teamRepository.find({
      order: { name: 'ASC' },
    });

    return {
      pageTitle: '계약 현황',
      filter,
      result,
      teams,
    };
  }

  // 사원 실적 페이지
  @Get('performance')
  @Render('owner/performance')
  async performance(@Query() query: PerformanceQuery) {
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

    const filter: PerformanceFilter = {
      period,
      from: query.from,
      to: query.to,
      qTeam: query.qTeam || undefined,
      qSalesperson: query.qSalesperson || undefined,
    };

    const result = await this.ownerService.getPerformance(filter);

    const teams = await this.teamRepository.find({
      order: { name: 'ASC' },
    });

    return {
      pageTitle: '사원 / 팀 실적',
      filter,
      contractsByStaff: result.contractsByStaff,
      contractsByTeam: result.contractsByTeam,
      surveysByStaff: result.surveysByStaff,
      scheduledByStaff: result.scheduledByStaff,
      teams,
    };
  }

  // 핀 통계 페이지
  @Get('pins')
  @Render('owner/pins')
  async pins(@Query() query: PinsQuery) {
    const filter = this.buildPinStatsFilter(query);
    const stats = await this.ownerService.getPinStats(filter);

    return {
      pageTitle: '핀 통계 분석',
      filter: stats.filter,
      stats,
    };
  }

  // 매출/비용 페이지
  @Get('finance')
  @Render('owner/finance')
  async finance(@Query() query: FinanceQuery) {
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

    const filter: FinanceFilter = {
      period,
      from: query.from,
      to: query.to,
      qTeam: query.qTeam || undefined,
      qSalesperson: query.qSalesperson || undefined,
    };

    const result = await this.ownerService.getFinanceSummary(filter);

    // 팀 리스트 (필터용)
    const teams = await this.teamRepository.find({
      order: { name: 'ASC' },
    });

    return {
      pageTitle: '정산 / 매출 분석',
      filter,
      summary: result.summary,
      bySalesperson: result.bySalesperson,
      byTeam: result.byTeam,
      teams,
    };
  }

  private buildContractsFilter(query: ContractsQuery): ContractListFilter {
    const statusValues: StatusFilter[] = ['all', 'ongoing', 'done', 'canceled'];
    const periodValues: PeriodFilter[] = [
      'today',
      'week',
      'month',
      'quarter',
      'half',
      'year',
      'custom',
    ];
    const sortValues: SortKey[] = ['contractDate', 'grandTotal', 'createdAt'];
    const dirValues: SortDir[] = ['asc', 'desc'];

    const status =
      (statusValues.find((v) => v === query.status) as
        | StatusFilter
        | undefined) ?? 'all';

    const period =
      (periodValues.find((v) => v === query.period) as
        | PeriodFilter
        | undefined) ?? 'month';

    const sort =
      (sortValues.find((v) => v === query.sort) as SortKey | undefined) ??
      'contractDate';

    const dir =
      (dirValues.find((v) => v === query.dir) as SortDir | undefined) ?? 'desc';

    const page = Math.max(1, Number(query.page ?? '1') || 1);
    const pageSize = Math.max(
      1,
      Math.min(200, Number(query.pageSize ?? '20') || 20),
    );

    const idFrom = query.idFrom ? Number(query.idFrom) : undefined;
    const idTo = query.idTo ? Number(query.idTo) : undefined;
    const grandMin = query.grandMin ? Number(query.grandMin) : undefined;
    const grandMax = query.grandMax ? Number(query.grandMax) : undefined;

    return {
      status,
      period,
      from: query.from,
      to: query.to,
      qCustomer: query.qCustomer || undefined,
      qSalesperson: query.qSalesperson || undefined,
      qTeam: query.qTeam || undefined,
      sort,
      dir,
      page,
      pageSize,
      idFrom: Number.isFinite(idFrom) ? idFrom : undefined,
      idTo: Number.isFinite(idTo) ? idTo : undefined,
      grandMin: Number.isFinite(grandMin) ? grandMin : undefined,
      grandMax: Number.isFinite(grandMax) ? grandMax : undefined,
    };
  }

  private buildPinStatsFilter(query: PinsQuery): PinStatsFilter {
    const cityValues: PinCityFilter[] = ['all', 'seoul', 'incheon', 'gyeonggi'];
    const periodValues: PeriodFilter[] = [
      'today',
      'week',
      'month',
      'quarter',
      'half',
      'year',
      'custom',
    ];

    const city =
      (cityValues.find((v) => v === query.city) as PinCityFilter | undefined) ??
      'all';

    const period =
      (periodValues.find((v) => v === query.period) as
        | PeriodFilter
        | undefined) ?? 'year';

    return {
      city,
      period,
      from: query.from,
      to: query.to,
    };
  }
}
