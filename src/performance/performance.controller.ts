import { Controller, Get, Param, Query } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { PerformanceFilterDto } from './dto/performance-filter.dto';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  @Get('summary')
  async summary(@Query() dto: PerformanceFilterDto) {
    const data = await this.service.getSummary(dto);
    return { message: '실적 요약', data };
  }

  @Get('teams/:teamId')
  async teamEmployees(
    @Param('teamId') teamId: string,
    @Query() dto: PerformanceFilterDto,
  ) {
    const data = await this.service.getTeamEmployees(teamId, dto);
    return { message: '팀 직원별 실적', data };
  }
}
