import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpAdapterHost } from '@nestjs/core';
import type { RedisClientType } from 'redis';

@Injectable()
export class AppService {
  private readonly redisClient: RedisClientType | null;

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly adapterHost: HttpAdapterHost,
  ) {
    const expressApp = this.adapterHost.httpAdapter.getInstance();
    this.redisClient =
      (expressApp.get('redisClient') as RedisClientType) ?? null;
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

  private async checkRedis(): Promise<boolean> {
    try {
      if (!this.redisClient) return false;
      const pong = await this.redisClient.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
