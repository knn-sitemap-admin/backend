import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpAdapterHost } from '@nestjs/core';
import type { RedisClientType } from 'redis';

@Injectable()
export class AppService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

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
      console.error('[health][redis] ping failed', {
        message: e instanceof Error ? e.message : String(e),
        code: (e as any)?.code,
      });
      return false;
    }
  }
}
