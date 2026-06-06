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
    await this.migrateMillionToWonUnit();
  }

  private async migrateMillionToWonUnit() {
    try {
      this.logger.log('[Migration] Starting unit prices migration (million -> won)...');

      // min_price 마이그레이션: 100,000 미만인 백만 단위 값을 원 단위로 변환 (* 1,000,000)
      const minResult = await this.ds.query(`
        UPDATE units 
        SET min_price = min_price * 1000000 
        WHERE min_price IS NOT NULL AND min_price > 0 AND min_price < 100000
      `);

      // max_price 마이그레이션
      const maxResult = await this.ds.query(`
        UPDATE units 
        SET max_price = max_price * 1000000 
        WHERE max_price IS NOT NULL AND max_price > 0 AND max_price < 100000
      `);

      const affectedMin = minResult?.affectedRows ?? 0;
      const affectedMax = maxResult?.affectedRows ?? 0;

      this.logger.log(`[Migration] Finished. min_price updated: ${affectedMin}, max_price updated: ${affectedMax}`);
    } catch (e) {
      this.logger.error('[Migration] Failed to migrate unit prices', e);
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
