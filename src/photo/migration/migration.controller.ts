import { Controller, Post, UseGuards } from '@nestjs/common';
import { MigrationService } from './migration.service';

@Controller('photo/migration')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post('run')
  async runMigration() {
    return await this.migrationService.migrateS3UrlsToKeys();
  }
}
