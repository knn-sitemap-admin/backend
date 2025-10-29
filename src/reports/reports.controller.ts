import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  // 필터 없음, 한 방 집계
  @Get('sales-overview')
  async getSalesOverview() {
    const data = await this.service.getSalesOverview();
    return { data };
  }
}
