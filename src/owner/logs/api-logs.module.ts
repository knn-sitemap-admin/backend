import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiRequestLog } from './entities/api-request-log.entity';
import { ApiLogWriterService } from './services/api-log-writer.service';
import { ApiLogMiddleware } from './middlewares/api-log.middleware';
import { ApiLogQueryService } from './api-log-query.service';
import { ApiLogsController } from './api-logs.controller';
import { ApiErrorLogQueryService } from './api-error-log-query.service';
import { ApiErrorLogsController } from './api-error-logs.controller';

import { ApiLogExportService } from './services/api-log-export.service';
import { ApiLogsExportController } from './api-logs-export.controller';
import { ApiLogCleanupService } from './services/api-log-cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiRequestLog])],
  controllers: [
    ApiLogsController,
    ApiErrorLogsController,
    ApiLogsExportController,
  ],
  providers: [
    ApiLogWriterService,
    ApiLogQueryService,
    ApiErrorLogQueryService,
    ApiLogExportService,
    ApiLogCleanupService,
  ],
})
export class ApiLogsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiLogMiddleware).forRoutes('*');
  }
}
