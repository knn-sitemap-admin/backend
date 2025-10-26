import { Controller, Get, Query } from '@nestjs/common';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly svc: PerformanceService) {}

  // 상단 카드: 총 계약건수, 총 최종수당, 총 지원금, 총 인원수
  @Get('summary')
  async summary(
    @Query('dateFrom') dateFrom?: string, // 'YYYY-MM-DD'
    @Query('dateTo') dateTo?: string, // 'YYYY-MM-DD'
    @Query('teamId') teamId?: string, // 선택
  ) {
    const data = await this.svc.summary({
      dateFrom,
      dateTo,
      teamId: teamId ? Number(teamId) : undefined,
    });
    return { data };
  }

  // 팀별 막대/파이: 팀 인원수, 팀별 최종수당 합, 팀별 지원금 합, 계약/해약 건수
  @Get('by-team')
  async byTeam(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const data = await this.svc.byTeam({ dateFrom, dateTo });
    return { data };
  }

  // 개인 랭킹(선택): 담당자별 최종수당 합/계약건수
  @Get('by-assignee')
  async byAssignee(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('teamId') teamId?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.svc.byAssignee({
      dateFrom,
      dateTo,
      teamId: teamId ? Number(teamId) : undefined,
      limit: limit ? Number(limit) : 10,
    });
    return { data };
  }
}
