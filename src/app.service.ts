import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(@InjectDataSource() private readonly ds: DataSource) {
    const url = process.env.REDIS_URL;

    this.redis = url
      ? new Redis(url, { lazyConnect: true })
      : new Redis({
          host: process.env.REDIS_HOST ?? '127.0.0.1',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
          lazyConnect: true,
        });

    this.redis.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.error(
        '[ioredis] client error:',
        e instanceof Error ? e.message : e,
      );
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

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      /* ignore */
    }
  }
}
