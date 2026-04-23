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

  @Get('platform-statistics')
  async platformStatistics(@Query() dto: PerformanceFilterDto) {
    const data = await this.service.getPlatformStatistics(dto);
    return { message: '플랫폼별 통계', data };
  }

  @Get('teams/:teamId')
  async teamEmployees(
    @Param('teamId') teamId: string,
    @Query() dto: PerformanceFilterDto,
  ) {
    const data = await this.service.getTeamEmployees(teamId, dto);
    return { message: '팀 직원별 실적', data };
  }

  @Get('employees')
  async listEmployees() {
    const data = await this.service.listEmployees();
    return { message: '직원 목록', data };
  }

  @Get('employees/:accountId')
  async employeePerformance(
    @Param('accountId') accountId: string,
    @Query('year') year?: number,
  ) {
    const targetYear = year ?? new Date().getFullYear();
    const data = await this.service.getEmployeePerformance(accountId, targetYear);
    return { message: '영업자별 실적 추이', data };
  }

  @Get('available-periods')
  async availablePeriods() {
    const data = await this.service.getAvailablePeriods();
    return { message: '데이터가 존재하는 기간 목록', data };
  }
}
