import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpAdapterHost } from '@nestjs/core';
import type { RedisClientType } from 'redis';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  async onModuleInit() {
    try {
      // 긴급: 배포 서버 재시작 시 DB에 컬럼이 없어서 뻗는 이슈 해결용
      const columnsResult = await this.ds.query(`SHOW COLUMNS FROM pin_drafts LIKE 'is_sales_stopped'`);
      if (columnsResult.length === 0) {
        await this.ds.query(`ALTER TABLE pin_drafts ADD COLUMN is_sales_stopped BOOLEAN DEFAULT FALSE NOT NULL`);
        this.logger.log('Emergency Migration: Added is_sales_stopped to pin_drafts');
      }
    } catch (err) {
      this.logger.error('Emergency Migration Failed:', err);
    }
  }

  async check() {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDB(),
      this.checkRedis(),
    ]);
    return { dbStatus, redisStatus };
  }

  private async checkDB(): Promise<boolean> {
    try {
      await this.ds.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private getRedisClient(): RedisClientType | null {
    const expressApp = this.adapterHost.httpAdapter.getInstance();
    return (expressApp.get('redisClient') as RedisClientType) ?? null;
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const redisClient = this.getRedisClient();
      if (!redisClient) return false;
      const pong = await redisClient.ping();
      return pong === 'PONG';
    } catch (e) {
      this.logger.error('[health][redis] ping failed', {
        message: e instanceof Error ? e.message : String(e),
        code: (e as any)?.code,
      });
      return false;
    }
  }
}
