import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  private redis: Redis;

  constructor(@InjectDataSource() private readonly ds: DataSource) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
    });
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
      if (!this.redis.status || this.redis.status === 'end') {
        await this.redis.connect();
      }
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
