import { Module } from '@nestjs/common';

import { OwnerPageController } from './pages/owner-page.controller';
import { ApiLogsModule } from './logs/api-logs.module';
import { OwnerSessionsModule } from './sessions/owner-sessions.module';
import { OwnerStatsModule } from './stats/owner-stats.module';
import { OwnerAuthPageController } from './owner-auth.controller';
import { AuthModule } from '../dashboard/auth/auth.module';

@Module({
  imports: [ApiLogsModule, OwnerSessionsModule, OwnerStatsModule, AuthModule],
  controllers: [OwnerPageController, OwnerAuthPageController],
})
export class OwnerModule {}
