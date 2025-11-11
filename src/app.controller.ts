import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async get() {
    const { dbStatus, redisStatus } = await this.appService.check();

    const status =
      dbStatus && redisStatus
        ? 'ok'
        : dbStatus || redisStatus
          ? 'partial'
          : 'fail';

    return {
      messages: 'health check',
      data: {
        database: dbStatus ? 'ok' : 'fail',
        redis: redisStatus ? 'ok' : 'fail',
        status,
      },
    };
  }

  @Get('favicon.ico')
  ignore() {
    return '';
  }
}
